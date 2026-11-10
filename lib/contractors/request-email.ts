import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAppUrl } from "@/lib/app-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { DAILY_LIMIT_MESSAGE } from "@/lib/email/send-cap";
import { sendOnboardingEmail } from "@/lib/email/onboarding";
import {
  RESEND_COOLDOWN_SECONDS,
  cooldownMessage,
  isMissingColumnError,
  resendCooldown,
  tokenExpiryFrom,
} from "@/lib/contractor-details-logic";

/**
 * The one place a company-triggered "here's your upload link" email is sent.
 *
 * Three buttons used to each hand-roll their own token lookup and send
 * (the contractors-list "Resend request", the per-document "Send new
 * request", and now the checkbox resend). They now all come through here, so
 * the cooldown and the link-expiry refresh can't be present on one path and
 * missing from another — which would make the cooldown trivially bypassable
 * by using the button that didn't have it.
 *
 * Takes the caller's Supabase client so ownership stays the caller's job and
 * RLS keeps applying: a company's client can only ever see its own
 * contractors' token rows, so a contractor id belonging to anyone else finds
 * no row and comes back as `no_link`.
 */

export type RequestSendResult =
  | { ok: true }
  | { ok: false; reason: "cooldown"; retryAfterSeconds: number; message: string }
  | {
      ok: false;
      reason: "no_link" | "not_configured" | "send_failed" | "prepare_failed" | "daily_limit";
      message: string;
    };

interface TokenRow {
  token: string;
}

export async function sendRequestToContractor(
  supabase: SupabaseClient,
  input: {
    /** The caller's company: its daily email cap is charged. */
    companyId: string;
    contractor: { id: string; email: string; contact_name: string | null };
    companyName: string;
    replyTo: string | null;
    /** Genuinely outstanding documents. */
    documentNames: string[];
    /** Documents with a valid copy on file, being re-requested as an updated copy. */
    refreshDocumentNames?: string[];
    /**
     * Runs once the cooldown slot is held and immediately before the email
     * goes out — the place to make any database changes the email describes
     * (e.g. adding a replacement row). Running it AFTER the cooldown check means
     * a blocked resend changes nothing, and a `{ ok: false }` here releases the
     * slot and stops the send.
     */
    prepare?: () => Promise<{ ok: true } | { ok: false; message: string }>;
  },
): Promise<RequestSendResult> {
  const { contractor } = input;

  // Read through the caller's own client, so RLS still decides whether this
  // company can see this contractor's link at all.
  const { data: tokenRow, error: tokenError } = await supabase
    .from("contractor_tokens")
    .select("token")
    .eq("contractor_id", contractor.id)
    .maybeSingle<TokenRow>();

  if (tokenError) {
    console.error("sendRequestToContractor: token lookup failed", {
      code: tokenError.code,
      message: tokenError.message,
    });
    return {
      ok: false,
      reason: "no_link",
      message: "Couldn't look up this contractor's upload link. Try again.",
    };
  }
  if (!tokenRow) {
    return {
      ok: false,
      reason: "no_link",
      message: "This contractor has no active upload link. Contact support.",
    };
  }

  // The cooldown lives in contractor_request_cooldowns, which only the server
  // can write (migration 0020). It used to be a column on the token row that
  // the company itself could reset, which made the cooldown optional.
  // claim_request_cooldown checks and stamps in one statement, so two clicks
  // at the same instant can't both send.
  const admin = createAdminClient();
  let claimed = false;
  const claim = await admin.rpc("claim_request_cooldown", {
    p_contractor_id: contractor.id,
    p_window_seconds: RESEND_COOLDOWN_SECONDS,
  });

  if (claim.error) {
    // Fails OPEN. An anti-spam check that can't run must never stop a
    // legitimate send. The daily email cap still applies below.
    console.error("sendRequestToContractor: couldn't claim the resend slot, sending anyway", {
      code: claim.error.code,
      message: claim.error.message,
    });
  } else if (claim.data !== true) {
    const { data: stamp } = await admin
      .from("contractor_request_cooldowns")
      .select("last_sent_at")
      .eq("contractor_id", contractor.id)
      .maybeSingle<{ last_sent_at: string }>();
    const check = resendCooldown(stamp?.last_sent_at ?? null, new Date());
    const retryAfterSeconds = check.allowed ? RESEND_COOLDOWN_SECONDS : check.retryAfterSeconds;
    return {
      ok: false,
      reason: "cooldown",
      retryAfterSeconds,
      message: cooldownMessage(retryAfterSeconds),
    };
  } else {
    claimed = true;
  }

  // Hands the cooldown slot back: nothing was delivered, so a failure
  // shouldn't cost the company a wait.
  const release = async () => {
    if (!claimed) return;
    await admin.rpc("release_request_cooldown", { p_contractor_id: contractor.id });
  };

  if (input.prepare) {
    const prepared = await input.prepare();
    if (!prepared.ok) {
      await release();
      return { ok: false, reason: "prepare_failed", message: prepared.message };
    }
  }

  // We're about to email the link, so it has to stay valid.
  await refreshTokenExpiry(contractor.id);

  const appUrl = await getAppUrl();
  const result = await sendOnboardingEmail({
    companyId: input.companyId,
    to: contractor.email,
    contactName: contractor.contact_name,
    companyName: input.companyName,
    replyTo: input.replyTo,
    documentNames: input.documentNames,
    refreshDocumentNames: input.refreshDocumentNames,
    onboardUrl: `${appUrl}/onboard/${tokenRow.token}`,
  });

  if (!result.ok) {
    await release();
    if (result.reason === "not_configured") {
      return {
        ok: false,
        reason: "not_configured",
        message: "Email isn't configured yet, so the request couldn't be sent.",
      };
    }
    if (result.reason === "daily_limit") {
      return { ok: false, reason: "daily_limit", message: DAILY_LIMIT_MESSAGE };
    }
    return {
      ok: false,
      reason: "send_failed",
      message: "The email service rejected the request. Try again shortly.",
    };
  }

  return { ok: true };
}

/**
 * Extends a contractor's upload link, for the emails that carry it but aren't
 * a "resend" (a rejection notice, an expiry reminder). Anything that hands a
 * contractor the link has to leave it valid, otherwise the email arrives
 * pointing at a page that says the link has expired. Never throws: a failure
 * here must not stop the email it's attached to.
 */
export async function refreshTokenExpiry(contractorId: string): Promise<void> {
  // Service role: owners can only read their token rows (migration 0020).
  // Every caller has already proven the contractor belongs to its company.
  const { error } = await createAdminClient()
    .from("contractor_tokens")
    .update({ expires_at: tokenExpiryFrom() })
    .eq("contractor_id", contractorId);

  if (error && !isMissingColumnError(error)) {
    console.error("refreshTokenExpiry failed", {
      contractorId,
      code: error.code,
      message: error.message,
    });
  }
}

/**
 * Kills a contractor's upload link immediately by setting its expiry to the
 * epoch. Used as the first step of deleting a contractor, so nothing new can
 * arrive through the link while their files are being removed. Expiring it,
 * rather than deleting the row, means a delete that fails part-way leaves a
 * contractor who is still recoverable (a resend refreshes the link) instead of
 * one with no link at all.
 */
export async function disableUploadLink(contractorId: string): Promise<boolean> {
  // Service role, as in refreshTokenExpiry: the caller has proven ownership.
  const { error } = await createAdminClient()
    .from("contractor_tokens")
    .update({ expires_at: new Date(0).toISOString() })
    .eq("contractor_id", contractorId);

  if (error) {
    console.error("disableUploadLink failed", {
      contractorId,
      code: error.code,
      message: error.message,
    });
    return false;
  }
  return true;
}

/**
 * Gives a contractor a brand new upload link: a fresh token, valid for the
 * usual period. The old link stops working at once (M2). Used when the
 * contractor's email changes, so a link sent to the old address is dead, and
 * by the "Revoke link" button. Nothing is emailed: the new link goes out with
 * the next request the company sends.
 */
export async function rotateUploadLink(contractorId: string): Promise<boolean> {
  // Service role, as in refreshTokenExpiry: the caller has proven ownership.
  const { data, error } = await createAdminClient()
    .from("contractor_tokens")
    .update({ token: randomUUID(), expires_at: tokenExpiryFrom() })
    .eq("contractor_id", contractorId)
    .select("contractor_id");

  if (error || !data || data.length === 0) {
    console.error("rotateUploadLink failed", { contractorId, code: error?.code, found: data?.length ?? 0 });
    return false;
  }
  return true;
}
