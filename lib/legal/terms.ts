/**
 * Single source of truth for which version of the Terms of Service is live.
 *
 * Bump BOTH values whenever the wording of app/(marketing)/terms/page.tsx
 * changes in a way that matters. The version is stamped onto every new
 * account at signup (user metadata), so it's what lets you say later exactly
 * which terms a given customer agreed to.
 */
export const TERMS_VERSION = "2026-09-30";

/** Human-readable form of the same date, shown on the Terms page. */
export const TERMS_LAST_UPDATED = "30 September 2026";
