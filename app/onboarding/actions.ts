"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCompany } from "@/lib/supabase/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlement } from "@/lib/billing/entitlements";
import { FREE_TIER } from "@/lib/billing/plans";

/**
 * Starts the 7-day free access window and passes the forced-onboarding gate.
 * No card is collected.
 */
export async function startFreeAccess(): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) {
    return { ok: false, error: "Your session has expired. Reload and try again." };
  }

  const entitlement = await getEntitlement(company.id);
  if (entitlement.onboardingCompleted) {
    // Already chosen — nothing to do.
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const now = new Date();
  const freeEndsAt = new Date(now.getTime() + FREE_TIER.days * 86_400_000);

  const { error } = await admin.from("subscriptions").upsert(
    {
      company_id: company.id,
      status: "free",
      free_ends_at: freeEndsAt.toISOString(),
      onboarding_completed_at: now.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "company_id" },
  );

  if (error) {
    console.error("startFreeAccess failed", error);
    return { ok: false, error: "Couldn't start free access. Try again." };
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
