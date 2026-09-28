/**
 * Pure rules for managing a contractor — edit validation, ABN handling, the
 * resend cooldown, and upload-link expiry. No I/O and no "server-only", so
 * the same functions run in the server actions (the real decision) and can be
 * tested directly under `node --test`, like every other *-logic.ts here.
 */

// --- upload-link expiry -----------------------------------------------------

/** How long an upload link stays valid after the app last emailed it. */
export const TOKEN_TTL_DAYS = 60;

/** A fresh expiry, TOKEN_TTL_DAYS from `now`. */
export function tokenExpiryFrom(now: Date = new Date()): string {
  return new Date(now.getTime() + TOKEN_TTL_DAYS * 86_400_000).toISOString();
}

/**
 * Whether a link is past its expiry. NULL means "never expires" and is NOT
 * expired: every link issued before expiry existed has no value, and treating
 * that as expired would have killed every link already in a contractor's inbox
 * the moment this shipped.
 */
export function isTokenExpired(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false; // unparseable: never lock someone out on a guess
  return t <= now.getTime();
}

/**
 * Whether a PostgREST/Postgres error means "that column doesn't exist" —
 * i.e. a migration hasn't been run on this project yet. Used so the
 * contractor-facing upload link keeps working on a deploy that lands before
 * its migration, instead of every link reading as invalid.
 */
export function isMissingColumnError(
  error: { code?: string | null } | null | undefined,
): boolean {
  return error?.code === "42703" || error?.code === "PGRST204";
}

// --- resend cooldown --------------------------------------------------------

export const RESEND_COOLDOWN_SECONDS = 5 * 60;

export type CooldownCheck =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/** Whether another request may go out, given when the last one did. */
export function resendCooldown(
  lastSentAt: string | null | undefined,
  now: Date = new Date(),
): CooldownCheck {
  if (!lastSentAt) return { allowed: true };
  const last = new Date(lastSentAt).getTime();
  if (Number.isNaN(last)) return { allowed: true };

  const remainingMs = RESEND_COOLDOWN_SECONDS * 1000 - (now.getTime() - last);
  if (remainingMs <= 0) return { allowed: true };
  return { allowed: false, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

export function cooldownMessage(retryAfterSeconds: number): string {
  const wait =
    retryAfterSeconds < 60
      ? `${retryAfterSeconds} ${retryAfterSeconds === 1 ? "second" : "seconds"}`
      : `${Math.ceil(retryAfterSeconds / 60)} ${
          Math.ceil(retryAfterSeconds / 60) === 1 ? "minute" : "minutes"
        }`;
  return `A request was just sent to this contractor. You can send another in ${wait}.`;
}

// --- choosing which documents to resend ------------------------------------

export const MAX_RESEND_DOCUMENTS = 50;

export type ResendSelection =
  | { ok: true; ids: string[] }
  | { ok: false; error: string };

/**
 * Checks a requested set of document ids against the documents that can
 * actually be requested from this contractor right now. Any id that isn't in
 * that set fails the whole request rather than being silently dropped: a
 * stale page selecting something that has since been approved should be told
 * so, not quietly sent a different email than the one it asked for.
 */
export function selectResendable(
  requestedIds: unknown,
  eligibleIds: string[],
): ResendSelection {
  if (!Array.isArray(requestedIds) || requestedIds.some((id) => typeof id !== "string")) {
    return { ok: false, error: "Select at least one document." };
  }
  const unique = [...new Set(requestedIds as string[])];
  if (unique.length === 0) return { ok: false, error: "Select at least one document." };
  if (unique.length > MAX_RESEND_DOCUMENTS) {
    return { ok: false, error: "Select fewer documents." };
  }
  const eligible = new Set(eligibleIds);
  if (unique.some((id) => !eligible.has(id))) {
    return {
      ok: false,
      error:
        "One of those documents is no longer waiting on the contractor. Refresh and try again.",
    };
  }
  return { ok: true, ids: unique };
}

// --- ABN --------------------------------------------------------------------

export type AbnResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * An ABN is 11 digits; spaces are allowed while typing and stripped on save.
 * Empty is valid and stored as null — the field is optional, and every
 * existing contractor has none. Deliberately NOT the ATO's weighted checksum:
 * the requirement is "11 digits", and a checksum would reject real numbers
 * someone mistyped by one digit with no way to say "I know, save it anyway".
 */
export function normalizeAbn(raw: string): AbnResult {
  const compact = raw.replace(/\s+/g, "");
  if (compact === "") return { ok: true, value: null };
  if (!/^\d{11}$/.test(compact)) {
    return { ok: false, error: "An ABN is 11 digits, e.g. 12 345 678 901." };
  }
  return { ok: true, value: compact };
}

/** 12345678901 -> "12 345 678 901" for display. Anything unexpected passes through. */
export function formatAbn(digits: string | null | undefined): string {
  if (!digits) return "";
  const d = digits.replace(/\s+/g, "");
  if (!/^\d{11}$/.test(d)) return digits;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
}

// --- editing contact + business details ------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ContractorDetailsInput {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  abn: string;
}

export interface ContractorDetailsFieldErrors {
  businessName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  abn?: string;
}

/** The row shape written to `contractors`. */
export interface ContractorDetailsRow {
  business_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  abn: string | null;
}

export type ContractorDetailsResult =
  | { ok: true; data: ContractorDetailsRow }
  | { ok: false; fieldErrors: ContractorDetailsFieldErrors };

/**
 * The single source of truth for what an edit may contain. The form runs it
 * for instant feedback and the server action runs it again as the real gate —
 * same limits as createContractor so a contractor can't be edited into a
 * shape it couldn't have been created in.
 */
export function validateContractorDetails(
  input: ContractorDetailsInput,
): ContractorDetailsResult {
  const businessName = String(input.businessName ?? "").trim();
  const contactName = String(input.contactName ?? "").trim();
  const email = String(input.email ?? "").trim().toLowerCase();
  const phone = String(input.phone ?? "").trim();

  const fieldErrors: ContractorDetailsFieldErrors = {};

  if (!businessName) fieldErrors.businessName = "Enter the contractor's business name.";
  else if (businessName.length > 120) fieldErrors.businessName = "Keep this under 120 characters.";

  if (contactName.length > 120) fieldErrors.contactName = "Keep this under 120 characters.";

  if (!email) fieldErrors.email = "Enter an email address.";
  else if (email.length > 254 || !EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";

  if (phone.length > 40) fieldErrors.phone = "Keep this under 40 characters.";

  const abn = normalizeAbn(String(input.abn ?? ""));
  if (!abn.ok) fieldErrors.abn = abn.error;

  if (Object.keys(fieldErrors).length > 0 || !abn.ok) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    data: {
      business_name: businessName,
      contact_name: contactName || null,
      email,
      phone: phone || null,
      abn: abn.value,
    },
  };
}

/** Whether the form differs from what's saved — drives the Save button. */
export function detailsChanged(
  current: ContractorDetailsInput,
  saved: ContractorDetailsInput,
): boolean {
  const norm = (v: string) => v.trim();
  const abnDigits = (v: string) => v.replace(/\s+/g, "");
  return (
    norm(current.businessName) !== norm(saved.businessName) ||
    norm(current.contactName) !== norm(saved.contactName) ||
    norm(current.email).toLowerCase() !== norm(saved.email).toLowerCase() ||
    norm(current.phone) !== norm(saved.phone) ||
    abnDigits(current.abn) !== abnDigits(saved.abn)
  );
}
