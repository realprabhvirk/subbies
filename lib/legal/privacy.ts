/**
 * Single source of truth for which version of the Privacy Policy is live.
 *
 * Bump BOTH values whenever the wording of app/(marketing)/privacy/page.tsx
 * changes in a way that matters. The version is recorded against every
 * document a contractor submits (contractor_documents.agreed_privacy_version),
 * next to the terms version in lib/legal/terms.ts.
 */
export const PRIVACY_VERSION = "2026-11-09.2";

/** Human-readable form of the same date, shown on the Privacy Policy page. */
export const PRIVACY_LAST_UPDATED = "9 November 2026";
