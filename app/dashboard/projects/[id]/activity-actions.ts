"use server";

import { getSubscriptionRow } from "@/lib/billing/entitlements";
import { can, isPlanId } from "@/lib/billing/plans";
import { getCompany } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { loadProjectActivity, type ActivityEvent } from "./_lib/activity";

/** The next page of activity for "Load more". Business+ only, checked here. */
export async function loadMoreActivity(
  projectId: string,
  cursor: string,
): Promise<{ ok: true; events: ActivityEvent[]; nextCursor: string | null } | { ok: false; error: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };
  const sub = await getSubscriptionRow(company.id);
  if (!can(isPlanId(sub?.plan) ? sub!.plan : null, "activityView")) {
    return { ok: false, error: "Activity history isn't included in your plan." };
  }
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).eq("company_id", company.id).maybeSingle();
  if (!project) return { ok: false, error: "Couldn't find that project." };
  const page = await loadProjectActivity(projectId, { cursor });
  if (page.error) return { ok: false, error: "Couldn't load more activity. Try again." };
  return { ok: true, events: page.events, nextCursor: page.nextCursor };
}
