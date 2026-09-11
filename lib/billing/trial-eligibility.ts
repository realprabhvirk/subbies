import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import {
  shouldSkipTrial,
  emailUsedTrialFromLookup,
} from "./trial-eligibility-policy";

export { shouldSkipTrial, emailUsedTrialFromLookup };

/**
 * Permanent ledger of normalized emails that have already consumed a free
 * trial — written once, on confirmed account deletion (see
 * app/dashboard/settings/deletion-actions.ts), and never cleared.
 *
 * Exists because the pre-existing loophole check in startCheckout
 * (`hadSubscriptionBefore`, keyed off the *company's* own subscription row)
 * only protects a company that still exists. Delete the account and its
 * company row is gone too, so that check alone would let the same person
 * sign up again under the same email and get a second free trial. This
 * table is keyed on the email instead, and survives the deletion.
 *
 * Interacts with the pvirk0@outlook.com testing exemption in
 * lib/auth/normalize-email.ts exactly as intended: pvirk0+1@outlook.com and
 * pvirk0+2@outlook.com normalize to two different strings there, so deleting
 * one has no effect on the other's trial eligibility here either — each is a
 * fully independent test identity, which is the whole reason that exemption
 * exists.
 */

/** Has this email already consumed a trial under a now-deleted account? */
export async function hasUsedTrial(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("used_trial_emails")
    .select("email")
    .eq("email", normalizeEmail(email))
    .maybeSingle<{ email: string }>();

  if (error) {
    // Loud, because a broken ledger means the anti-abuse check is silently
    // not running — but it must NOT deny the trial to everyone. See
    // emailUsedTrialFromLookup for why this fails open rather than closed.
    // PGRST205 here means migration 0009 hasn't been run on this project.
    console.error("hasUsedTrial: lookup failed, allowing the trial", error);
  }

  return emailUsedTrialFromLookup({
    found: data !== null,
    lookupFailed: Boolean(error),
  });
}

/**
 * Cheap probe that the ledger table is actually reachable.
 *
 * Used as a preflight in the deletion flow specifically so a missing or
 * broken ledger is caught BEFORE the irreversible Stripe cancellation,
 * rather than after it — otherwise a failure to record the ledger leaves
 * someone with their subscription cancelled and their account still there.
 */
export async function isTrialLedgerReachable(): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("used_trial_emails").select("email").limit(1);

  if (error) {
    console.error(
      "isTrialLedgerReachable: used_trial_emails is unreachable — has migration 0009 been run?",
      error,
    );
    return false;
  }
  return true;
}

/** Idempotent — safe to call even if this email is already recorded. */
export async function recordUsedTrial(email: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("used_trial_emails")
    .upsert(
      { email: normalizeEmail(email), deleted_at: new Date().toISOString() },
      { onConflict: "email" },
    );
  if (error) {
    console.error("recordUsedTrial: upsert failed", error);
    // Thrown rather than swallowed: confirmAccountDeletion treats a failure
    // to record this as fatal to the whole deletion, not just this ledger —
    // see the comment there for why.
    throw error;
  }
}
