"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompany, requireUser } from "@/lib/supabase/dal";
import { MAX_COMPANY_NAME } from "@/lib/auth/signup-logic";

export interface AccountSetupState {
  ok: boolean;
  error?: string;
}

/**
 * Creates the company row for a signed-in user who doesn't have one.
 *
 * The one legitimate way an account ends up in that state is signup not
 * being able to insert the row itself (see lib/auth/signup-logic.ts). Runs
 * through the RLS-scoped client on purpose: the `companies` insert policy is
 * `user_id = auth.uid()`, so this can only ever create a company owned by the
 * caller — there's no id in the request to tamper with. Idempotent: an
 * account that already has a company gets `ok` and nothing is inserted.
 */
export async function completeAccountSetup(
  _prev: AccountSetupState | null,
  formData: FormData,
): Promise<AccountSetupState> {
  const user = await requireUser();

  const existing = await getCompany();
  if (existing) return { ok: true };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Enter your company name." };
  if (name.length > MAX_COMPANY_NAME) {
    return { ok: false, error: `Keep it under ${MAX_COMPANY_NAME} characters.` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .insert({ user_id: user.id, name });

  if (error) {
    console.error("completeAccountSetup: company insert failed", {
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: "Couldn't finish setup. Try again in a moment." };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function markNotificationsRead(): Promise<{ ok: boolean }> {
  const company = await getCompany();
  if (!company) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("company_id", company.id)
    .is("read_at", null);

  if (error) {
    console.error("markNotificationsRead failed", error);
    return { ok: false };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
