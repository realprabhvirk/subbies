import test from "node:test";
import assert from "node:assert/strict";

import { validateNoteBody, formatNoteTimestamp, MAX_NOTE_LENGTH } from "./contractor-notes-logic.ts";

test("a note is trimmed", () => {
  assert.deepEqual(validateNoteBody("  Called, chasing insurance  "), {
    ok: true,
    value: "Called, chasing insurance",
  });
});

test("empty, whitespace-only and non-string notes are rejected", () => {
  for (const bad of ["", "   ", "\n\t", undefined, null, 42, {}]) {
    assert.equal(validateNoteBody(bad).ok, false, JSON.stringify(bad));
  }
});

test("the length limit matches the database check, inclusive", () => {
  assert.equal(validateNoteBody("a".repeat(MAX_NOTE_LENGTH)).ok, true);
  assert.equal(validateNoteBody("a".repeat(MAX_NOTE_LENGTH + 1)).ok, false);
});

test("line breaks inside a note are preserved", () => {
  const r = validateNoteBody("line one\nline two");
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value, "line one\nline two");
});

test("timestamps are Sydney time, not the server's: 11pm UTC is already tomorrow in Sydney", () => {
  // 2026-06-14 23:30 UTC is 09:30 on the 15th in Sydney (AEST, UTC+10).
  assert.match(formatNoteTimestamp("2026-06-14T23:30:00Z"), /15 June? 2026/);
  assert.match(formatNoteTimestamp("2026-06-14T23:30:00Z"), /9:30\s?am/i);
});

test("daylight saving is honoured (AEDT, UTC+11, in January)", () => {
  assert.match(formatNoteTimestamp("2026-01-14T23:30:00Z"), /15 Jan 2026/);
  assert.match(formatNoteTimestamp("2026-01-14T23:30:00Z"), /10:30\s?am/i);
});

test("an unparseable timestamp renders as empty rather than 'Invalid Date'", () => {
  assert.equal(formatNoteTimestamp("garbage"), "");
});
