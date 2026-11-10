"use server";

import { createClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/auth/password-policy";

export type SetPasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Sets a new password for the signed-in session: the reset-password page
 * (recovery session) and Settings → Change password both come through here.
 *
 * L2: the 10-character rule used to be checked only in the browser, which a
 * direct request skips. It's now checked on the server first. Supabase's own
 * minimum password length (Auth settings in the dashboard) should also be 10,
 * since the Supabase API can be called without going through this action.
 */
export async function saveNewPassword(password: unknown): Promise<SetPasswordResult> {
  if (typeof password !== "string") return { ok: false, error: "Enter a new password." };

  const check = validatePassword(password);
  if (!check.ok) return { ok: false, error: check.error ?? "Pick a stronger password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
