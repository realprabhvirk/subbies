import test from "node:test";
import assert from "node:assert/strict";

import { secretMatches, hasCronSecret } from "./secret-compare.ts";

test("secretMatches: exact match only", () => {
  assert.equal(secretMatches("s3cret-value", "s3cret-value"), true);
  assert.equal(secretMatches("s3cret-valuX", "s3cret-value"), false);
  assert.equal(secretMatches("s3cret", "s3cret-value"), false, "a prefix is not a match");
  assert.equal(secretMatches("s3cret-value-and-more", "s3cret-value"), false);
});

test("secretMatches: an unset or empty expected secret never matches", () => {
  assert.equal(secretMatches("", ""), false);
  assert.equal(secretMatches(null, undefined), false);
  assert.equal(secretMatches("anything", ""), false);
});

test("hasCronSecret: needs the exact Bearer header", () => {
  assert.equal(hasCronSecret("Bearer abc123", "abc123"), true);
  assert.equal(hasCronSecret("abc123", "abc123"), false);
  assert.equal(hasCronSecret("Bearer abc12", "abc123"), false);
  assert.equal(hasCronSecret(null, "abc123"), false);
  assert.equal(hasCronSecret("Bearer ", ""), false);
  assert.equal(hasCronSecret("Bearer undefined", undefined), false);
});
