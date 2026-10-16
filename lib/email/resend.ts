import "server-only";

import { Resend } from "resend";

/** Returns a configured Resend client, or null if the API key isn't set yet. */
export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

/**
 * The address Subbies mail is sent from.
 *
 * RESEND_FROM is the one source of truth — set it in Vercel to a sender on a
 * domain you've verified in Resend (e.g. "Subbies <hello@your-domain>"). There
 * is deliberately NO hardcoded fallback to a real domain: a wrong-brand parked
 * domain in the From line is exactly what makes a contractor's first email
 * from us look like phishing and land in spam.
 *
 * If RESEND_FROM is unset or still points at the old parked domain:
 *   - in production we DON'T crash sends (a bounced send is worse than a
 *     badly-branded one), but we log a loud warning so the misconfiguration
 *     is visible, and fall back to the old value only if it's the one present;
 *   - everywhere else we use Resend's own test sender (onboarding@resend.dev),
 *     which is always deliverable in dev and never pretends to be a real brand.
 */
const OLD_PARKED_SENDER = "Subbies <onboarding@unknwnmoving.store>";
const RESEND_TEST_SENDER = "Subbies <onboarding@resend.dev>";

function resolveFromAddress(): string {
  const configured = process.env.RESEND_FROM?.trim();
  const isProd = process.env.NODE_ENV === "production";

  if (configured && configured !== OLD_PARKED_SENDER) return configured;

  if (isProd) {
    console.warn(
      configured === OLD_PARKED_SENDER
        ? "RESEND_FROM still points at the old parked domain (unknwnmoving.store). Set it to a sender on a domain verified in Resend. Sending from it for now."
        : "RESEND_FROM is not set in production. Set it to a sender on a domain verified in Resend. Falling back to the old parked sender so mail still goes out.",
    );
    // Keep production email working with whatever is actually present.
    return configured || OLD_PARKED_SENDER;
  }

  // Local / preview: never use a real-looking domain.
  return RESEND_TEST_SENDER;
}

export const FROM_ADDRESS = resolveFromAddress();

/**
 * Optional default Reply-To (RESEND_REPLY_TO), used for mail that doesn't set
 * its own. Contractor-facing mail already replies to the builder who sent it;
 * this covers the rest (billing, account, internal) so a reply reaches a real
 * inbox instead of the unmonitored From address. `undefined` when unset, which
 * Resend treats as "no reply-to".
 */
export const REPLY_TO_ADDRESS: string | undefined =
  process.env.RESEND_REPLY_TO?.trim() || undefined;

/** The reply-to to use: an explicit per-message one wins, else the default. */
export function resolveReplyTo(explicit?: string | null): string | undefined {
  return explicit ?? REPLY_TO_ADDRESS;
}
