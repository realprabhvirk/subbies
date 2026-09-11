/**
 * Turns a Postgres/PostgREST error into a message that actually tells the
 * contractor something useful, instead of one flat "Couldn't save the
 * upload. Try again." for every possible failure.
 *
 * The bug this exists to fix wasn't really "uploads fail" — it was that
 * submitStagedDocuments already caught and logged the real error
 * server-side (console.error on both the file insert and the status
 * update), but returned the exact same string whether the cause was a
 * schema-cache hiccup on the brand-new contractor_document_files table, a
 * real constraint violation, or something else entirely. That collapsed
 * three different problems — one that clears up if you just try again,
 * one that won't, and everything else — into a message that gives no
 * signal for which one happened, to the contractor or to whoever has to
 * debug it next.
 *
 * Pure and dependency-free on purpose: it needs to import cleanly under
 * plain `node --test`, and it's the one piece of this bug's fix that can
 * actually be exercised with a realistic, reproducible test without a live
 * Supabase project — feed it the shape of error Postgres/PostgREST
 * actually returns and check what a contractor would see.
 */

export type SubmissionErrorCategory = "transient" | "permanent";

export interface SubmissionErrorClassification {
  category: SubmissionErrorCategory;
  /** Shown to the contractor. Never includes the raw code/message — those go to console.error instead. */
  message: string;
}

interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
}

// PostgREST's own error codes for "the schema cache doesn't know about this
// table/column/relationship yet" — exactly what would happen if the
// contractor_document_files table (added for multi-file support) hadn't
// finished propagating to PostgREST's cache after its migration ran.
// https://postgrest.org/en/stable/references/errors.html
const SCHEMA_CACHE_CODES = new Set(["PGRST202", "PGRST204", "PGRST205"]);

// Postgres error codes (SQLSTATE) for connection/timeout-shaped failures —
// nothing about the request itself was wrong, the database just didn't
// answer in time. https://www.postgresql.org/docs/current/errcodes-appendix.html
const TRANSIENT_SQLSTATES = new Set([
  "08000", // connection_exception
  "08003", // connection_does_not_exist
  "08006", // connection_failure
  "57014", // query_canceled
  "53300", // too_many_connections
]);

// Postgres error codes for a genuine data problem — retrying with the same
// input will fail the same way every time.
const VALIDATION_SQLSTATES = new Set([
  "23502", // not_null_violation
  "23503", // foreign_key_violation
  "23505", // unique_violation
  "23514", // check_violation
]);

const TRANSIENT_MESSAGE =
  "There was a connection issue saving your upload. Your files are still attached below — wait a moment and press Submit again.";

const PERMANENT_MESSAGE =
  "Something went wrong saving this upload. Reply to the email you received so they know, and try again shortly.";

/**
 * Classifies a Postgres/PostgREST error into what to tell the contractor.
 * Defaults to "transient" for anything unrecognized — an unnecessary retry
 * prompt costs someone one extra click; wrongly telling them to go contact
 * support for something that would have resolved itself on retry is worse.
 * Same asymmetric-cost reasoning as failing open on the trial-eligibility
 * check: the safer default is the one with the smaller blast radius when
 * it's wrong.
 */
export function classifySubmissionError(
  error: PostgrestLikeError | null | undefined,
): SubmissionErrorClassification {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();

  if (SCHEMA_CACHE_CODES.has(code) || TRANSIENT_SQLSTATES.has(code)) {
    return { category: "transient", message: TRANSIENT_MESSAGE };
  }
  if (VALIDATION_SQLSTATES.has(code)) {
    return { category: "permanent", message: PERMANENT_MESSAGE };
  }
  // Permission errors (RLS denial, insufficient privilege) are real and
  // won't fix themselves on retry — but on this specific code path every
  // write already goes through the service-role client, which bypasses RLS
  // entirely, so a 42501 here would mean something structural rather than
  // "this particular request wasn't allowed". Still permanent either way.
  if (code === "42501") {
    return { category: "permanent", message: PERMANENT_MESSAGE };
  }
  // Network-level failures (fetch throwing rather than Postgres responding)
  // don't carry a Postgres code at all — recognizable by message content
  // instead.
  if (/fetch failed|network|timeout|econnreset|etimedout/.test(message)) {
    return { category: "transient", message: TRANSIENT_MESSAGE };
  }

  return { category: "transient", message: TRANSIENT_MESSAGE };
}
