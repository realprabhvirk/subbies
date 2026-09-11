"use server";

import { requireUser, getCompany } from "@/lib/supabase/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/billing/stripe";
import { getEntitlement } from "@/lib/billing/entitlements";
import { recordUsedTrial, isTrialLedgerReachable } from "@/lib/billing/trial-eligibility";
import { deleteAllCompanyDocuments } from "@/lib/storage";
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

export interface CodeCheckState {
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
 * Checks a submitted code WITHOUT deleting anything. This is what gates
 * moving from the code-entry screen to the consent screen (warning text +
 * required checkbox) — the actual deletion only happens after that consent
 * step, via confirmAccountDeletion below, which re-checks the code itself
 * rather than trusting that this call already happened.
 */
export async function verifyAccountDeletionCode(code: string): Promise<CodeCheckState> {
  const user = await requireUser();
  const check = await verifyDeletionCode(user.id, code.trim());
  if (!check.ok) {
    return { ok: false, error: CODE_ERROR_MESSAGE[check.reason] };
  }
  return { ok: true };
}

export interface ConfirmDeletionState {
  ok: boolean;
  error?: string;
}

/**
 * Confirms a deletion code and, if the user has explicitly acknowledged the
 * consequences, deletes the account.
 *
 * `consentAcknowledged` mirrors the required checkbox on the confirmation
 * screen ("I understand my data and billing will be permanently deleted...")
 * — checked here server-side too, not just disabled client-side, because a
 * disabled button is a UI nicety, not a guarantee. The code itself is
 * re-verified from scratch rather than trusting that verifyAccountDeletionCode
 * already ran: this function is reachable directly, and the one thing that
 * must never be true is "the account got deleted without a correct code."
 *
 * Ordering from here is deliberate and matters:
 *   1. Stripe cancellation — has to actually succeed (or already be gone)
 *      before anything else moves. The one step that can't be undone from
 *      our side if it's skipped.
 *   2. Wipe stored documents — independent of Stripe and of the ledger, so
 *      it runs here rather than being tangled into either's success/failure.
 *   3. Record the trial ledger, then delete the auth user — kept adjacent
 *      and paired with a rollback, since these are the two steps closest to
 *      "point of no return."
 */
export async function confirmAccountDeletion(
  code: string,
  consentAcknowledged: boolean,
): Promise<ConfirmDeletionState> {
  const user = await requireUser();
  if (!user.email) {
    return { ok: false, error: "Your account has no email on file. Contact support." };
  }

  if (!consentAcknowledged) {
    return {
      ok: false,
      error: "You need to confirm you understand this before continuing.",
    };
  }

  const check = await verifyDeletionCode(user.id, code.trim());
  if (!check.ok) {
    return { ok: false, error: CODE_ERROR_MESSAGE[check.reason] };
  }

  // 0. Preflight. Step 3 below writes the trial ledger, and step 1 cancels
  //    billing irreversibly — so if the ledger is unreachable (most likely a
  //    migration never run), find that out now, while nothing has been
  //    touched, instead of after the subscription is already cancelled. That
  //    ordering is what stops a broken ledger from leaving someone cancelled
  //    but not deleted.
  if (!(await isTrialLedgerReachable())) {
    console.error(
      "confirmAccountDeletion: aborting before any irreversible step — trial ledger unreachable",
    );
    return {
      ok: false,
      error:
        "Account deletion isn't available right now. Nothing was changed or cancelled. Contact support.",
    };
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

  // 2. Wipe stored documents. Nothing in Postgres cascades these — Storage's
  //    objects table has no FK relationship to public.companies at all — so
  //    this is the one part of deletion that has to happen in code rather
  //    than fall out of deleting the auth user. Best-effort: a failed batch
  //    is logged for manual cleanup rather than blocking the rest of the
  //    deletion (see deleteAllCompanyDocuments for why).
  if (company) {
    const storageResult = await deleteAllCompanyDocuments(company.id);
    if (storageResult.failedPaths.length > 0) {
      console.error(
        "confirmAccountDeletion: some stored documents were not removed — needs manual cleanup",
        { companyId: company.id, failedPaths: storageResult.failedPaths },
      );
    }
  }

  // 3. Record the trial ledger before touching the auth user. If step 4
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

  // 4. Delete the auth user. This cascades (0008 + 0010 migrations) to the
  //    company row and everything under it — document types, contractors,
  //    contractor tokens, documents, projects, subscriptions, notifications
  //    — and to auth.sessions, which is what actually invalidates every
  //    session on every device. There is no separate revoke-all-sessions
  //    call; the cascade delete of the sessions table is what does it.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("confirmAccountDeletion: deleteUser failed", deleteError);
    // Best-effort undo of step 3 so this email isn't wrongly flagged as
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
