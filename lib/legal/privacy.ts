/**
 * Privacy Policy status, version and details, kept in one place.
 *
 * ── The switch ──────────────────────────────────────────────────────────────
 * PRIVACY_POLICY_IN_FORCE is the single control for the big "NOT IN USE / NOT
 * VALID" banner on /privacy. While Subbies is in testing the policy is a draft
 * with no legal effect, so this is `false` and the banner shows. Flip it to
 * `true` (after a human/legal review — see the report) and the banner
 * disappears with no other change needed.
 *
 * ── Before flipping the switch ───────────────────────────────────────────────
 * Fill in the real values below. They are deliberately left as visible
 * placeholders because the legal entity that will own Subbies isn't confirmed
 * yet, and nothing here should be invented.
 */

export const PRIVACY_POLICY_IN_FORCE = false;

/**
 * Which version of the Privacy Policy is live.
 *
 * Bump BOTH PRIVACY_VERSION and PRIVACY_LAST_UPDATED whenever the wording of
 * app/(marketing)/privacy/page.tsx changes in a way that matters. The version
 * is recorded against every document a contractor submits
 * (contractor_documents.agreed_privacy_version), next to the terms version in
 * lib/legal/terms.ts.
 */
export const PRIVACY_VERSION = "2026-11-09.2";

/** Human-readable form of the same date, shown on the Privacy Policy page. */
export const PRIVACY_LAST_UPDATED = "9 November 2026";

/**
 * The entity that is the data controller. Placeholders until the owning legal
 * entity is confirmed. `[...]` text is shown on the page verbatim so it's
 * obvious it still needs filling in.
 */
export const LEGAL_ENTITY_NAME = "[Business name / trading name]";
export const LEGAL_ENTITY_ABN = "[Your ABN]";

/**
 * Where to reach a human about privacy. No dedicated privacy inbox exists yet,
 * so the page links to /contact instead of a dead mailto. When a real inbox
 * exists, set PRIVACY_EMAIL to it and the page will use it.
 */
export const PRIVACY_EMAIL: string | null = null; // TODO: set to e.g. "privacy@<real-domain>" once it exists

/**
 * Where customer data physically lives, for the "data location" line. The app
 * can't read a provider's region at runtime, so these are stated here.
 * Resend/SES mail was observed routing via ap-northeast-1 (Tokyo) in the
 * audit. The Supabase project region isn't in the repo — confirm it in the
 * Supabase dashboard (Project Settings → General → Region) and replace the
 * placeholder before the policy goes live.
 */
export const DATA_REGION_SUPABASE = "[CONFIRM: Supabase project region]";
export const DATA_REGION_EMAIL = "Asia Pacific (Tokyo), via Resend / Amazon SES";
