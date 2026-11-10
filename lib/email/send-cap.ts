import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "./resend";
import type { SendResult } from "./onboarding";

/**
 * Per-company cap on emails sent to addresses the company typed in itself
 * (contractor requests, approvals, rejections, expiry reminders). Without it,
 * an account could use Subbies to send unlimited mail, with its own wording,
 * to any address.
 *
 * Emails to the account's own verified address (billing, deletion codes,
 * "a contractor submitted something") are not counted: they can't be pointed
 * at a stranger, and counting them would let a contractor spamming uploads
 * use up the company's allowance.
 */
export const COMPANY_DAILY_EMAIL_CAP = 200;
export const COMPANY_EMAIL_WINDOW_SECONDS = 24 * 60 * 60;

export const DAILY_LIMIT_MESSAGE = `This company has reached its limit of ${COMPANY_DAILY_EMAIL_CAP} emails in 24 hours. Try again tomorrow.`;

export type CappedEmailKind = "request" | "approved" | "rejected" | "expiry_reminder";

export type SendSlot = { ok: true; release: () => Promise<void> } | { ok: false };

/**
 * Reserves one send for the company, atomically (claim_email_send, migration
 * 0020). Call `release()` if the email then fails, so a failed send doesn't
 * use up the allowance.
 *
 * Fails OPEN on a database error, like the other anti-spam checks here: a
 * broken counter must never stop a company reaching its contractors. The
 * error is logged so it doesn't go unnoticed.
 */
export async function claimCompanyEmailSend(
  companyId: string,
  kind: CappedEmailKind,
): Promise<SendSlot> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_email_send", {
    p_company_id: companyId,
    p_kind: kind,
    p_cap: COMPANY_DAILY_EMAIL_CAP,
    p_window_seconds: COMPANY_EMAIL_WINDOW_SECONDS,
  });

  if (error) {
    console.error("claimCompanyEmailSend: cap check failed, sending anyway", {
      companyId,
      code: error.code,
      message: error.message,
    });
    return { ok: true, release: async () => {} };
  }

  if (!data) return { ok: false };

  const reservationId = data as string;
  return {
    ok: true,
    release: async () => {
      const { error: releaseError } = await admin
        .from("email_send_log")
        .delete()
        .eq("id", reservationId);
      if (releaseError) {
        console.error("claimCompanyEmailSend: couldn't release a failed send", {
          companyId,
          code: releaseError.code,
        });
      }
    },
  };
}

type ResendPayload = Parameters<NonNullable<ReturnType<typeof getResend>>["emails"]["send"]>[0];

/**
 * Sends one capped email: claims the company's slot, sends, and hands the
 * slot back if Resend rejects it. The only way contractor-facing mail goes
 * out, so the cap can't be skipped by a new call site.
 */
export async function sendCappedEmail(
  companyId: string,
  kind: CappedEmailKind,
  payload: ResendPayload,
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { ok: false, reason: "not_configured" };

  const slot = await claimCompanyEmailSend(companyId, kind);
  if (!slot.ok) return { ok: false, reason: "daily_limit" };

  const { data, error } = await resend.emails.send(payload);
  if (error) {
    console.error(`capped ${kind} email failed`, error);
    await slot.release();
    return { ok: false, reason: "send_failed", error: error.message };
  }
  return { ok: true, id: data?.id ?? null };
}
