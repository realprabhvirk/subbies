import test from "node:test";
import assert from "node:assert/strict";

import {
  classifySignupResult,
  companyNameFromMetadata,
  MAX_COMPANY_NAME,
} from "./signup-logic.ts";

// --- classifySignupResult ---------------------------------------------------

test("user + session (email confirmation OFF) -> session_ready", () => {
  const outcome = classifySignupResult({
    user: { identities: [{ id: "x" }] },
    session: { access_token: "t" },
  });
  assert.equal(outcome, "session_ready");
});

test("user but no session (email confirmation ON) -> confirmation_pending, not a failure", () => {
  // This is the exact shape that used to fall through to an RLS-denied
  // company insert and a dead-end account.
  const outcome = classifySignupResult({
    user: { identities: [{ id: "x" }] },
    session: null,
  });
  assert.equal(outcome, "confirmation_pending");
});

test("Supabase's anti-enumeration shape (user with empty identities, no session) -> already_registered", () => {
  const outcome = classifySignupResult({
    user: { identities: [] },
    session: null,
  });
  assert.equal(outcome, "already_registered");
});

test("empty identities is already_registered even if a session is somehow present", () => {
  const outcome = classifySignupResult({
    user: { identities: [] },
    session: { access_token: "t" },
  });
  assert.equal(outcome, "already_registered");
});

test("identities missing entirely (undefined/null) is NOT treated as already-registered", () => {
  assert.equal(
    classifySignupResult({ user: { identities: undefined }, session: { a: 1 } }),
    "session_ready",
  );
  assert.equal(
    classifySignupResult({ user: { identities: null }, session: null }),
    "confirmation_pending",
  );
});

test("no user at all -> no_user", () => {
  assert.equal(classifySignupResult({ user: null, session: null }), "no_user");
});

// --- companyNameFromMetadata ------------------------------------------------

test("a normal name is trimmed and returned", () => {
  assert.equal(companyNameFromMetadata("  Virk Construction  "), "Virk Construction");
});

test("non-string, empty, or whitespace-only metadata -> null", () => {
  assert.equal(companyNameFromMetadata(undefined), null);
  assert.equal(companyNameFromMetadata(null), null);
  assert.equal(companyNameFromMetadata(42), null);
  assert.equal(companyNameFromMetadata({ name: "x" }), null);
  assert.equal(companyNameFromMetadata(""), null);
  assert.equal(companyNameFromMetadata("   "), null);
});

test("an over-long name is capped at the same limit the settings form enforces", () => {
  const long = "a".repeat(MAX_COMPANY_NAME + 50);
  assert.equal(companyNameFromMetadata(long)?.length, MAX_COMPANY_NAME);
});
