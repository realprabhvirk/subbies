import test from "node:test";
import assert from "node:assert/strict";

import {
  matchPreset,
  daysForPreset,
  removeDay,
  addDay,
  MAX_REMINDER_DAY,
  MAX_REMINDERS,
} from "./reminder-schedule-logic.ts";

// --- matchPreset -----------------------------------------------------------

test("matches Standard exactly", () => {
  assert.equal(matchPreset([30, 14, 7]), "standard");
});

test("matches Aggressive exactly", () => {
  assert.equal(matchPreset([30, 14, 7, 3, 1]), "aggressive");
});

test("matches Minimal exactly", () => {
  assert.equal(matchPreset([7]), "minimal");
});

test("matches No reminders (empty array)", () => {
  assert.equal(matchPreset([]), "none");
});

test("one day removed from Standard no longer matches — Custom", () => {
  assert.equal(matchPreset([30, 7]), "custom");
});

test("an extra day added to a preset no longer matches — Custom", () => {
  assert.equal(matchPreset([30, 14, 7, 2]), "custom");
});

test("same numbers as Standard in a different order do NOT match (order matters)", () => {
  // Presets are always sorted descending; a caller must sort before matching.
  assert.equal(matchPreset([7, 14, 30]), "custom");
});

// --- daysForPreset -----------------------------------------------------------

test("daysForPreset returns a fresh array for a real preset key", () => {
  const a = daysForPreset("standard");
  const b = daysForPreset("standard");
  assert.deepEqual(a, [30, 14, 7]);
  assert.notEqual(a, b, "should not return the same array reference twice");
});

test("daysForPreset('none') returns an empty array, not null", () => {
  assert.deepEqual(daysForPreset("none"), []);
});

test("daysForPreset('custom') returns null — a no-op, chips stay untouched", () => {
  assert.equal(daysForPreset("custom"), null);
});

test("daysForPreset of an unknown key returns null", () => {
  assert.equal(daysForPreset("nonsense"), null);
});

// --- removeDay -----------------------------------------------------------

test("removeDay drops exactly the matching day and keeps order", () => {
  assert.deepEqual(removeDay([30, 14, 7], 14), [30, 7]);
});

test("removeDay on a day not present is a no-op", () => {
  assert.deepEqual(removeDay([30, 14, 7], 99), [30, 14, 7]);
});

test("removing the last chip leaves an empty array (== No reminders)", () => {
  const afterRemoval = removeDay([7], 7);
  assert.deepEqual(afterRemoval, []);
  assert.equal(matchPreset(afterRemoval), "none");
});

// --- addDay -----------------------------------------------------------

test("adds a valid new day, inserted sorted descending", () => {
  const result = addDay([30, 14, 7], "45");
  assert.deepEqual(result, { ok: true, days: [45, 30, 14, 7] });
});

test("adding into the middle of the range still sorts correctly", () => {
  const result = addDay([30, 7], "14");
  assert.deepEqual(result, { ok: true, days: [30, 14, 7] });
});

test("empty input is not an error — nothing to add, nothing wrong", () => {
  const result = addDay([30, 14, 7], "   ");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "");
});

test("rejects a non-integer", () => {
  const result = addDay([30], "abc");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /whole number/i);
});

test("rejects zero and negative numbers", () => {
  for (const v of ["0", "-5"]) {
    const result = addDay([30], v);
    assert.equal(result.ok, false, `expected ${v} to be rejected`);
  }
});

test("rejects a duplicate day", () => {
  const result = addDay([30, 14, 7], "14");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /already/i);
});

test("rejects a day beyond MAX_REMINDER_DAY", () => {
  const result = addDay([30], String(MAX_REMINDER_DAY + 1));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /or fewer/i);
});

test("accepts a day exactly at MAX_REMINDER_DAY", () => {
  const result = addDay([30], String(MAX_REMINDER_DAY));
  assert.equal(result.ok, true);
});

test("rejects a new day once the list is already at MAX_REMINDERS", () => {
  const full = Array.from({ length: MAX_REMINDERS }, (_, i) => i + 1); // 1..10
  const result = addDay(full, String(MAX_REMINDERS + 50));
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /at most/i);
});

test("end to end: preset -> remove -> add lands on the same state a full manual edit would", () => {
  let days = daysForPreset("standard")!; // [30, 14, 7]
  days = removeDay(days, 14); // [30, 7]
  const added = addDay(days, "5");
  assert.equal(added.ok, true);
  if (added.ok) {
    assert.deepEqual(added.days, [30, 7, 5]);
    assert.equal(matchPreset(added.days), "custom");
  }
});
