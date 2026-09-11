import test from "node:test";
import assert from "node:assert/strict";

import { classifySubmissionError } from "./save-error-logic.ts";

// --- the exact failure mode this bug report was about --------------------

test("a schema-cache error on the new contractor_document_files table reads as transient, not a hard failure", () => {
  // What PostgREST actually returns when a table hasn't propagated to its
  // schema cache yet — exactly the shape a brand-new table added by a
  // recent migration could produce, and exactly the kind of error the
  // previous flat 'Couldn't save the upload. Try again.' gave zero signal
  // about.
  const result = classifySubmissionError({
    code: "PGRST205",
    message: "Could not find the table 'public.contractor_document_files' in the schema cache",
  });
  assert.equal(result.category, "transient");
  assert.match(result.message, /connection issue/i);
  // The contractor's staged files are still in the list after a failed
  // submit (the client never clears them on error) — the message should
  // say so rather than imply they need to start over.
  assert.match(result.message, /still attached/i);
});

test("PGRST204 (a missing column in the cached schema) is also transient", () => {
  const result = classifySubmissionError({ code: "PGRST204", message: "column not found" });
  assert.equal(result.category, "transient");
});

test("PGRST202 (a missing function/relationship in the cache) is also transient", () => {
  const result = classifySubmissionError({ code: "PGRST202", message: "not found" });
  assert.equal(result.category, "transient");
});

// --- other real Postgres failure shapes -----------------------------------

test("a connection failure (Postgres 08006) is transient", () => {
  const result = classifySubmissionError({ code: "08006", message: "connection failure" });
  assert.equal(result.category, "transient");
});

test("a query timeout (Postgres 57014) is transient", () => {
  const result = classifySubmissionError({ code: "57014", message: "canceling statement due to statement timeout" });
  assert.equal(result.category, "transient");
});

test("too many connections (Postgres 53300) is transient", () => {
  const result = classifySubmissionError({ code: "53300", message: "too many connections" });
  assert.equal(result.category, "transient");
});

test("a not-null violation (23502) is permanent — retrying with the same data won't help", () => {
  const result = classifySubmissionError({
    code: "23502",
    message: 'null value in column "file_path" violates not-null constraint',
  });
  assert.equal(result.category, "permanent");
  assert.match(result.message, /reply to the email/i);
});

test("a foreign key violation (23503) is permanent", () => {
  const result = classifySubmissionError({ code: "23503", message: "violates foreign key constraint" });
  assert.equal(result.category, "permanent");
});

test("a unique violation (23505) is permanent", () => {
  const result = classifySubmissionError({ code: "23505", message: "duplicate key value" });
  assert.equal(result.category, "permanent");
});

test("a check constraint violation (23514) is permanent", () => {
  const result = classifySubmissionError({ code: "23514", message: "violates check constraint" });
  assert.equal(result.category, "permanent");
});

test("permission denied (42501) is permanent", () => {
  const result = classifySubmissionError({ code: "42501", message: "permission denied for table" });
  assert.equal(result.category, "permanent");
});

// --- network-shaped failures with no Postgres code ------------------------

test("a bare 'fetch failed' error (no code at all) reads as transient", () => {
  const result = classifySubmissionError({ message: "fetch failed" });
  assert.equal(result.category, "transient");
});

test("a network/ECONNRESET-shaped message reads as transient", () => {
  const result = classifySubmissionError({ message: "request failed, reason: ECONNRESET" });
  assert.equal(result.category, "transient");
});

// --- the safe default ------------------------------------------------------

test("null/undefined error defaults to transient, not a scary permanent message", () => {
  assert.equal(classifySubmissionError(null).category, "transient");
  assert.equal(classifySubmissionError(undefined).category, "transient");
});

test("a completely unrecognized code defaults to transient (asymmetric cost: an unneeded retry prompt costs one click; a wrongly-alarming permanent message costs a support reply)", () => {
  const result = classifySubmissionError({ code: "XX999", message: "something bespoke" });
  assert.equal(result.category, "transient");
});

// --- never leaks raw error internals to the contractor --------------------

test("the contractor-facing message never includes the raw error code or message", () => {
  const raw = { code: "23502", message: "null value in column super_secret_internal_field" };
  const result = classifySubmissionError(raw);
  assert.ok(!result.message.includes(raw.code));
  assert.ok(!result.message.includes("super_secret_internal_field"));
});
