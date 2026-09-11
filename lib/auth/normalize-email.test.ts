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

test("TEMP testing exception: pvirk0@outlook.com's +tag variants stay distinct", () => {
  assert.equal(normalizeEmail("pvirk0+1@outlook.com"), "pvirk0+1@outlook.com");
  assert.equal(normalizeEmail("pvirk0+2@outlook.com"), "pvirk0+2@outlook.com");
  assert.notEqual(
    normalizeEmail("pvirk0+1@outlook.com"),
    normalizeEmail("pvirk0+2@outlook.com"),
  );
  // Case-insensitive, same as the rest of normalizeEmail.
  assert.equal(normalizeEmail("Pvirk0+Test@Outlook.com"), "pvirk0+test@outlook.com");
});

test("TEMP testing exception does not affect anyone else", () => {
  assert.equal(normalizeEmail("someoneelse+1@gmail.com"), "someoneelse@gmail.com");
});

test("TEMP testing exception is an exact match, not a prefix or substring match", () => {
  // A lookalike local part must NOT accidentally qualify for the exemption —
  // this is the case that would turn a testing convenience into a loophole.
  assert.equal(normalizeEmail("pvirk00+1@outlook.com"), "pvirk00@outlook.com");
  assert.equal(normalizeEmail("xpvirk0+1@outlook.com"), "xpvirk0@outlook.com");
  assert.equal(normalizeEmail("pvirk0.evil+1@outlook.com"), "pvirk0.evil@outlook.com");
});

test("TEMP testing exception does not extend to a different domain", () => {
  // Same local part, wrong domain — must not match.
  assert.equal(normalizeEmail("pvirk0+1@gmail.com"), "pvirk0@gmail.com");
});
