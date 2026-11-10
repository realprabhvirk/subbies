import test from "node:test";
import assert from "node:assert/strict";

import { normalizeEmail } from "./normalize-email.ts";

test("strips +tag and lowercases for Gmail", () => {
  assert.equal(normalizeEmail("Test+1@Gmail.com"), "test@gmail.com");
});

test("strips +tag and preserves dots for Outlook", () => {
  assert.equal(normalizeEmail("test.name+work@outlook.com"), "test.name@outlook.com");
});

test("leaves a non-alias domain untouched apart from casing", () => {
  assert.equal(normalizeEmail("real@company.com"), "real@company.com");
});

test("does not strip +tag on a domain outside the fixed list", () => {
  // A provider that treats + as a literal character would have this silently
  // merged with a different real inbox if we stripped it here.
  assert.equal(normalizeEmail("real+tag@company.com"), "real+tag@company.com");
});

test("lowercases a non-alias domain and its local part", () => {
  assert.equal(normalizeEmail("Real.Person@Company.COM"), "real.person@company.com");
});

test("covers every listed alias domain, not just gmail.com", () => {
  assert.equal(normalizeEmail("a+x@googlemail.com"), "a@googlemail.com");
  assert.equal(normalizeEmail("a+x@outlook.com"), "a@outlook.com");
  assert.equal(normalizeEmail("a+x@hotmail.com"), "a@hotmail.com");
  assert.equal(normalizeEmail("a+x@live.com"), "a@live.com");
});

test("trims surrounding whitespace", () => {
  assert.equal(normalizeEmail("  prabh+1@gmail.com  "), "prabh@gmail.com");
});

test("strips from the first + onward when there are multiple", () => {
  assert.equal(normalizeEmail("a+b+c@gmail.com"), "a@gmail.com");
});

test("a bare +tag with no other local part strips to an empty local part", () => {
  // Pathological input — not something a real signup form would produce, but
  // documenting the actual behavior rather than leaving it unspecified.
  assert.equal(normalizeEmail("+onlytag@gmail.com"), "@gmail.com");
});

test("input with no @ at all is only lowercased and trimmed, not rejected", () => {
  // normalizeEmail doesn't validate shape — callers already do that.
  assert.equal(normalizeEmail("  NotAnEmail  "), "notanemail");
});
