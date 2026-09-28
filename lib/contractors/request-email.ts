import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAppUrl } from "@/lib/app-url";
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
  | { ok: false; reason: "no_link" | "not_configured" | "send_failed"; message: string };

interface TokenRow {
  token: string;
  last_request_sent_at?: string | null;
}

export async function sendRequestToContractor(
  supabase: SupabaseClient,
  input: {
    contractor: { id: string; email: string; contact_name: string | null };
    companyName: string;
    replyTo: string | null;
    documentNames: string[];
  },
): Promise<RequestSendResult> {
  const { contractor } = input;

  // Read the token together with the cooldown stamp. If the stamp column
  // doesn't exist yet (this deployed before its migration ran), fall back to
  // reading the token alone: the send must keep working, it just goes out
  // without a cooldown until the migration lands.
  let tokenRow: TokenRow | null = null;
  let cooldownAvailable = true;

  const first = await supabase
    .from("contractor_tokens")
    .select("token, last_request_sent_at")
    .eq("contractor_id", contractor.id)
    .maybeSingle<TokenRow>();

  if (first.error && isMissingColumnError(first.error)) {
    cooldownAvailable = false;
    const fallback = await supabase
      .from("contractor_tokens")
      .select("token")
      .eq("contractor_id", contractor.id)
      .maybeSingle<TokenRow>();
    tokenRow = fallback.data;
  } else if (first.error) {
    console.error("sendRequestToContractor: token lookup failed", {
      code: first.error.code,
      message: first.error.message,
    });
    return {
      ok: false,
      reason: "no_link",
      message: "Couldn't look up this contractor's upload link. Try again.",
    };
  } else {
    tokenRow = first.data;
  }

  if (!tokenRow) {
    return {
      ok: false,
      reason: "no_link",
      message: "This contractor has no active upload link. Contact support.",
    };
  }

  const now = new Date();
  const previousSentAt = tokenRow.last_request_sent_at ?? null;
  let claimedAt: string | null = null;

  if (cooldownAvailable) {
    const check = resendCooldown(previousSentAt, now);
    if (!check.allowed) {
      return {
        ok: false,
        reason: "cooldown",
        retryAfterSeconds: check.retryAfterSeconds,
        message: cooldownMessage(check.retryAfterSeconds),
      };
    }

    // Claim the slot with a conditional write, so two clicks landing at the
    // same instant can't both pass the check above and both send. The
    // condition lives in the UPDATE itself: only one of them matches a row.
    // The same write extends the link's expiry, since we're about to email it.
    const cutoff = new Date(now.getTime() - RESEND_COOLDOWN_SECONDS * 1000).toISOString();
    const stamp = now.toISOString();
    const claim = await supabase
      .from("contractor_tokens")
      .update({ last_request_sent_at: stamp, expires_at: tokenExpiryFrom(now) })
      .eq("contractor_id", contractor.id)
      .or(`last_request_sent_at.is.null,last_request_sent_at.lt.${cutoff}`)
      .select("contractor_id");

    if (claim.error) {
      // Fails OPEN. An anti-spam check that can't run must never stop a
      // legitimate send — the same lesson as the trial-eligibility ledger.
      // The cost of being wrong is one extra email; the cost of failing
      // closed is a company unable to reach a contractor at all.
      console.error("sendRequestToContractor: couldn't claim the resend slot, sending anyway", {
        code: claim.error.code,
        message: claim.error.message,
      });
    } else if (!claim.data || claim.data.length === 0) {
      return {
        ok: false,
        reason: "cooldown",
        retryAfterSeconds: RESEND_COOLDOWN_SECONDS,
        message: cooldownMessage(RESEND_COOLDOWN_SECONDS),
      };
    } else {
      claimedAt = stamp;
    }
  }

  const appUrl = await getAppUrl();
  const result = await sendOnboardingEmail({
    to: contractor.email,
    contactName: contractor.contact_name,
    companyName: input.companyName,
    replyTo: input.replyTo,
    documentNames: input.documentNames,
    onboardUrl: `${appUrl}/onboard/${tokenRow.token}`,
  });

  if (!result.ok) {
    // Nothing was delivered, so it shouldn't cost the company a cooldown.
    if (claimedAt) {
      await supabase
        .from("contractor_tokens")
        .update({ last_request_sent_at: previousSentAt })
        .eq("contractor_id", contractor.id)
        .eq("last_request_sent_at", claimedAt);
    }
    return result.reason === "not_configured"
      ? {
          ok: false,
          reason: "not_configured",
          message: "Email isn't configured yet, so the request couldn't be sent.",
        }
      : {
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
export async function refreshTokenExpiry(
  supabase: SupabaseClient,
  contractorId: string,
): Promise<void> {
  const { error } = await supabase
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
export async function disableUploadLink(
  supabase: SupabaseClient,
  contractorId: string,
): Promise<boolean> {
  const { error } = await supabase
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
