import test from "node:test";
import assert from "node:assert/strict";

import { validatePassword, MIN_PASSWORD_LENGTH } from "./password-policy.ts";

test("minimum length is 10", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 10);
});

test("a password under 10 characters is rejected", () => {
  assert.equal(validatePassword("short").ok, false);
  assert.equal(validatePassword("ninechars").ok, false); // 9
  assert.match(validatePassword("ninechars").error!, /at least 10/);
});

test("a 10+ character non-obvious password is accepted", () => {
  assert.equal(validatePassword("correct-horse").ok, true);
  assert.equal(validatePassword("Tradie!Build42").ok, true);
});

test("common passwords are rejected even at length", () => {
  assert.equal(validatePassword("password123").ok, false);
  assert.equal(validatePassword("Password123").ok, false); // case-insensitive
  assert.equal(validatePassword("qwertyuiop").ok, false);
  assert.equal(validatePassword("subbies123").ok, false);
});

test("a single repeated character is rejected", () => {
  assert.equal(validatePassword("aaaaaaaaaa").ok, false);
});

test("the old 'password' (which the server used to accept) is rejected", () => {
  assert.equal(validatePassword("password").ok, false);
});
