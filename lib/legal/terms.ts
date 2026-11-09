/**
 * Single source of truth for which version of the Terms of Service is live.
 *
 * Bump BOTH values whenever the wording of app/(marketing)/terms/page.tsx
 * changes in a way that matters. The version is stamped onto every new
 * account at signup (user metadata), and onto every document a contractor
 * submits (contractor_documents.agreed_terms_version), so it's what lets you
 * say later exactly which terms a given person agreed to.
 */
export const TERMS_VERSION = "2026-11-09.2";

/** Human-readable form of the same date, shown on the Terms page. */
export const TERMS_LAST_UPDATED = "9 November 2026";
