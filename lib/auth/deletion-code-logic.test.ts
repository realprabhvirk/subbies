import test from "node:test";
import assert from "node:assert/strict";

import { evaluateDeletionCode, hashDeletionCode, MAX_ATTEMPTS } from "./deletion-code-logic.ts";

const FIXED_NOW = new Date("2026-01-01T00:00:00.000Z");

function futureExpiry(minutes = 10): string {
  return new Date(FIXED_NOW.getTime() + minutes * 60_000).toISOString();
}

function pastExpiry(minutes = 1): string {
  return new Date(FIXED_NOW.getTime() - minutes * 60_000).toISOString();
}

test("normal flow: correct code within its window and attempt budget passes", () => {
  const record = { codeHash: hashDeletionCode("123456"), expiresAt: futureExpiry(), attempts: 0 };
  assert.deepEqual(evaluateDeletionCode(record, "123456", FIXED_NOW), { ok: true });
});

test("wrong code entered is rejected as incorrect, not silently accepted", () => {
  const record = { codeHash: hashDeletionCode("123456"), expiresAt: futureExpiry(), attempts: 0 };
  assert.deepEqual(evaluateDeletionCode(record, "000000", FIXED_NOW), {
    ok: false,
    reason: "incorrect",
  });
});

test("expired code is rejected even when the digits are right", () => {
  const record = { codeHash: hashDeletionCode("123456"), expiresAt: pastExpiry(), attempts: 0 };
  assert.deepEqual(evaluateDeletionCode(record, "123456", FIXED_NOW), {
    ok: false,
    reason: "expired",
  });
});

test("no pending code at all (never requested, or already consumed) is rejected", () => {
  assert.deepEqual(evaluateDeletionCode(null, "123456", FIXED_NOW), {
    ok: false,
    reason: "no_code",
  });
});

test("too many wrong attempts locks the code out even with the right digits", () => {
  const record = {
    codeHash: hashDeletionCode("123456"),
    expiresAt: futureExpiry(),
    attempts: MAX_ATTEMPTS,
  };
  assert.deepEqual(evaluateDeletionCode(record, "123456", FIXED_NOW), {
    ok: false,
    reason: "too_many_attempts",
  });
});

test("hashDeletionCode is deterministic and distinguishes different codes", () => {
  assert.equal(hashDeletionCode("123456"), hashDeletionCode("123456"));
  assert.notEqual(hashDeletionCode("123456"), hashDeletionCode("654321"));
});
