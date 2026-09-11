"use server";

import { requireUser, getCompany } from "@/lib/supabase/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/billing/stripe";
import { getEntitlement } from "@/lib/billing/entitlements";
import { recordUsedTrial } from "@/lib/billing/trial-eligibility";
import {
  requestDeletionCode,
  verifyDeletionCode,
  type DeletionCodeCheck,
} from "@/lib/auth/deletion-codes";
import { sendAccountDeletionCodeEmail } from "@/lib/email/account-deletion";
import { normalizeEmail } from "@/lib/auth/normalize-email";

export interface RequestCodeState {
  ok: boolean;
  error?: string;
}

export async function requestAccountDeletionCode(): Promise<RequestCodeState> {
  const user = await requireUser();
  if (!user.email) {
    return { ok: false, error: "Your account has no email on file. Contact support." };
  }

  const result = await requestDeletionCode(user.id);
  if (!result.ok) {
    return {
      ok: false,
      error: `Please wait ${result.retryAfterSeconds}s before requesting another code.`,
    };
  }

  const sent = await sendAccountDeletionCodeEmail({
    to: user.email,
    code: result.code,
    expiresInMinutes: 10,
  });
  if (!sent.ok) {
    console.error("requestAccountDeletionCode: email send failed", sent);
    return { ok: false, error: "Couldn't send the code. Try again in a moment." };
  }

  return { ok: true };
}

export interface ConfirmDeletionState {
  ok: boolean;
  error?: string;
}

const CODE_ERROR_MESSAGE: Record<
  Extract<DeletionCodeCheck, { ok: false }>["reason"],
  string
> = {
  no_code: "Request a code first.",
  expired: "That code has expired. Request a new one.",
  too_many_attempts: "Too many wrong attempts. Request a new code.",
  incorrect: "That code isn't right. Check your email and try again.",
};

/**
 * Confirms a deletion code and, if it checks out, deletes the account.
 *
 * Ordering is deliberate and matters: Stripe is cancelled first and has to
 * actually succeed (or already be gone) before anything else moves. That's
 * the one step that can't be undone from our side if it's skipped — if it
 * fails, the whole flow stops right there, nothing is deleted, and the user
 * is told plainly instead of ending up deleted-but-still-billed.
 */
export async function confirmAccountDeletion(code: string): Promise<ConfirmDeletionState> {
  const user = await requireUser();
  if (!user.email) {
    return { ok: false, error: "Your account has no email on file. Contact support." };
  }

  const check = await verifyDeletionCode(user.id, code.trim());
  if (!check.ok) {
    return { ok: false, error: CODE_ERROR_MESSAGE[check.reason] };
  }

  const company = await getCompany();
  const admin = createAdminClient();

  // 1. Cancel billing immediately (not cancel-at-period-end) and confirm it
  //    actually happened before touching anything else.
  if (company) {
    const entitlement = await getEntitlement(company.id);
    if (entitlement.stripeSubscriptionId) {
      const stripe = getStripe();
      if (!stripe) {
        return {
          ok: false,
          error: "Billing isn't configured right now. Try again later or contact support.",
        };
      }
      try {
        await stripe.subscriptions.cancel(entitlement.stripeSubscriptionId);
      } catch (err) {
        const stripeErr = err as { code?: string };
        if (stripeErr.code !== "resource_missing") {
          console.error("confirmAccountDeletion: Stripe cancellation failed", err);
          return {
            ok: false,
            error:
              "Couldn't cancel your subscription, so nothing was deleted. Try again, or contact support if this keeps happening.",
          };
        }
        // resource_missing: Stripe already has no subscription to cancel
        // (e.g. cancelled some other way already) — nothing left to do here.
      }
    }
  }

  // 2. Record the trial ledger before touching the auth user. If step 3
  //    fails, this one insert is rolled back below (best-effort) — there is
  //    no way to roll back step 1's Stripe cancellation, which is exactly
  //    why that one runs first and is allowed to hard-stop the whole flow
  //    while this one doesn't.
  const normalizedEmail = normalizeEmail(user.email);
  try {
    await recordUsedTrial(normalizedEmail);
  } catch (err) {
    console.error("confirmAccountDeletion: failed to record trial ledger", err);
    return { ok: false, error: "Something went wrong. Try again, or contact support." };
  }

  // 3. Delete the auth user. This cascades (0008 + 0009 migrations) to the
  //    company row and everything under it — contractors, documents,
  //    projects, subscriptions, notifications — and to auth.sessions, which
  //    is what actually invalidates every session on every device. There is
  //    no separate revoke-all-sessions call; the cascade delete of the
  //    sessions table is what does it.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("confirmAccountDeletion: deleteUser failed", deleteError);
    // Best-effort undo of step 2 so this email isn't wrongly flagged as
    // trial-used for an account that, from the user's side, still exists.
    // Billing is already cancelled at this point and that part doesn't get
    // undone — the safe direction on failure is "not billed, not deleted"
    // rather than "billed and deleted" or "deleted and still billed."
    await admin.from("used_trial_emails").delete().eq("email", normalizedEmail);
    return {
      ok: false,
      error:
        "Your subscription was cancelled but we couldn't finish deleting your account. Contact support — you won't be charged again.",
    };
  }

  return { ok: true };
}
