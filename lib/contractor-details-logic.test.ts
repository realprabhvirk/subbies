import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAbn,
  formatAbn,
  validateContractorDetails,
  detailsChanged,
  resendCooldown,
  cooldownMessage,
  RESEND_COOLDOWN_SECONDS,
  selectResendable,
  isTokenExpired,
  tokenExpiryFrom,
  TOKEN_TTL_DAYS,
  isMissingColumnError,
  type ContractorDetailsInput,
} from "./contractor-details-logic.ts";

// --- ABN --------------------------------------------------------------------

test("an ABN with spaces is stripped to 11 bare digits on save", () => {
  assert.deepEqual(normalizeAbn("12 345 678 901"), { ok: true, value: "12345678901" });
  assert.deepEqual(normalizeAbn("  12345678901  "), { ok: true, value: "12345678901" });
});

test("an empty ABN is valid and stored as null (the field is optional)", () => {
  assert.deepEqual(normalizeAbn(""), { ok: true, value: null });
  assert.deepEqual(normalizeAbn("   "), { ok: true, value: null });
});

test("too few, too many, or non-digit ABNs are rejected", () => {
  for (const bad of ["1234567890", "123456789012", "12 345 678 90A", "12-345-678-901", "abcdefghijk"]) {
    assert.equal(normalizeAbn(bad).ok, false, `expected "${bad}" to be rejected`);
  }
});

test("formatAbn groups 11 digits and passes anything else through", () => {
  assert.equal(formatAbn("12345678901"), "12 345 678 901");
  assert.equal(formatAbn(null), "");
  assert.equal(formatAbn(""), "");
  assert.equal(formatAbn("not an abn"), "not an abn");
});

test("normalize then format round-trips", () => {
  const r = normalizeAbn("51 824 753 556");
  assert.ok(r.ok && r.value);
  assert.equal(formatAbn(r.ok ? r.value : null), "51 824 753 556");
});

// --- edit validation --------------------------------------------------------

const valid: ContractorDetailsInput = {
  businessName: "Northside Electrical",
  contactName: "Sam Lee",
  email: "Sam@Northside.example",
  phone: "0400 000 000",
  abn: "12 345 678 901",
};

test("a valid edit is normalised: trimmed, email lowercased, ABN stripped", () => {
  const r = validateContractorDetails({ ...valid, businessName: "  Northside Electrical  " });
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.data, {
      business_name: "Northside Electrical",
      contact_name: "Sam Lee",
      email: "sam@northside.example",
      phone: "0400 000 000",
      abn: "12345678901",
    });
  }
});

test("optional fields left blank become null, not empty strings", () => {
  const r = validateContractorDetails({ ...valid, contactName: "", phone: "", abn: "" });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.data.contact_name, null);
    assert.equal(r.data.phone, null);
    assert.equal(r.data.abn, null);
  }
});

test("business name and email are required", () => {
  const r = validateContractorDetails({ ...valid, businessName: "  ", email: "" });
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.ok(r.fieldErrors.businessName);
    assert.ok(r.fieldErrors.email);
  }
});

test("an invalid ABN is reported on the abn field, alongside any other errors", () => {
  const r = validateContractorDetails({ ...valid, abn: "123", email: "nope" });
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.ok(r.fieldErrors.abn);
    assert.ok(r.fieldErrors.email);
    assert.equal(r.fieldErrors.businessName, undefined);
  }
});

test("length limits match createContractor", () => {
  assert.ok(!validateContractorDetails({ ...valid, businessName: "a".repeat(121) }).ok);
  assert.ok(!validateContractorDetails({ ...valid, contactName: "a".repeat(121) }).ok);
  assert.ok(!validateContractorDetails({ ...valid, phone: "1".repeat(41) }).ok);
  assert.ok(validateContractorDetails({ ...valid, businessName: "a".repeat(120) }).ok);
});

test("malformed emails are rejected", () => {
  for (const bad of ["plain", "a@b", "a b@c.com", "@x.com", "a@.com"]) {
    assert.ok(!validateContractorDetails({ ...valid, email: bad }).ok, `expected "${bad}" rejected`);
  }
});

// --- dirty check (Save disabled until something changes) --------------------

test("identical form is not dirty; whitespace-only and case-only email changes are not edits", () => {
  assert.equal(detailsChanged(valid, valid), false);
  assert.equal(detailsChanged({ ...valid, businessName: "  Northside Electrical " }, valid), false);
  assert.equal(detailsChanged({ ...valid, email: "SAM@NORTHSIDE.EXAMPLE" }, valid), false);
});

test("ABN spacing alone is not an edit, but a different ABN is", () => {
  assert.equal(detailsChanged({ ...valid, abn: "12345678901" }, valid), false);
  assert.equal(detailsChanged({ ...valid, abn: "12 345 678 902" }, valid), true);
});

test("any real field change is dirty", () => {
  assert.equal(detailsChanged({ ...valid, businessName: "Other" }, valid), true);
  assert.equal(detailsChanged({ ...valid, contactName: "" }, valid), true);
  assert.equal(detailsChanged({ ...valid, phone: "0411" }, valid), true);
});

// --- resend cooldown --------------------------------------------------------

const NOW = new Date("2026-09-28T10:00:00Z");
const ago = (s: number) => new Date(NOW.getTime() - s * 1000).toISOString();

test("never sent before -> allowed", () => {
  assert.deepEqual(resendCooldown(null, NOW), { allowed: true });
  assert.deepEqual(resendCooldown(undefined, NOW), { allowed: true });
});

test("sent seconds ago -> blocked, reporting how long is left", () => {
  const r = resendCooldown(ago(30), NOW);
  assert.equal(r.allowed, false);
  if (!r.allowed) assert.equal(r.retryAfterSeconds, RESEND_COOLDOWN_SECONDS - 30);
});

test("the boundary: one second inside the window is blocked, exactly at it is allowed", () => {
  assert.equal(resendCooldown(ago(RESEND_COOLDOWN_SECONDS - 1), NOW).allowed, false);
  assert.equal(resendCooldown(ago(RESEND_COOLDOWN_SECONDS), NOW).allowed, true);
  assert.equal(resendCooldown(ago(RESEND_COOLDOWN_SECONDS + 1), NOW).allowed, true);
});

test("a garbage timestamp fails open rather than locking the company out", () => {
  assert.deepEqual(resendCooldown("not a date", NOW), { allowed: true });
});

test("the cooldown message says how long in plain words", () => {
  assert.match(cooldownMessage(1), /1 second\b/);
  assert.match(cooldownMessage(45), /45 seconds/);
  assert.match(cooldownMessage(60), /1 minute\b/);
  assert.match(cooldownMessage(61), /2 minutes/);
  assert.match(cooldownMessage(300), /5 minutes/);
});

// --- choosing documents -----------------------------------------------------

test("selecting nothing is rejected", () => {
  assert.equal(selectResendable([], ["a", "b"]).ok, false);
  assert.equal(selectResendable(undefined, ["a"]).ok, false);
  assert.equal(selectResendable("a", ["a"]).ok, false);
  assert.equal(selectResendable([1, 2], ["a"]).ok, false);
});

test("a valid selection is de-duplicated", () => {
  const r = selectResendable(["a", "a", "b"], ["a", "b", "c"]);
  assert.deepEqual(r, { ok: true, ids: ["a", "b"] });
});

test("an id that isn't currently resendable fails the whole request, not silently dropped", () => {
  const r = selectResendable(["a", "zzz"], ["a", "b"]);
  assert.equal(r.ok, false);
});

test("an id belonging to another contractor is indistinguishable from a stale one", () => {
  // Eligible ids are built from THIS contractor's documents only, so a
  // tampered request naming someone else's document id simply isn't in it.
  assert.equal(selectResendable(["other-companys-doc"], ["a", "b"]).ok, false);
});

// --- link expiry ------------------------------------------------------------

test("NULL expiry means never expires — grandfathered links stay alive", () => {
  assert.equal(isTokenExpired(null, NOW), false);
  assert.equal(isTokenExpired(undefined, NOW), false);
});

test("a future expiry is live, a past one is expired, and exactly-now is expired", () => {
  assert.equal(isTokenExpired("2026-09-28T10:00:01Z", NOW), false);
  assert.equal(isTokenExpired("2026-09-28T10:00:00Z", NOW), true);
  assert.equal(isTokenExpired("2026-09-27T10:00:00Z", NOW), true);
});

test("the disabled-link sentinel (epoch) reads as expired", () => {
  assert.equal(isTokenExpired(new Date(0).toISOString(), NOW), true);
});

test("an unparseable expiry never locks a contractor out", () => {
  assert.equal(isTokenExpired("garbage", NOW), false);
});

test("tokenExpiryFrom is exactly TOKEN_TTL_DAYS ahead", () => {
  const exp = new Date(tokenExpiryFrom(NOW)).getTime();
  assert.equal(exp - NOW.getTime(), TOKEN_TTL_DAYS * 86_400_000);
});

test("a fresh expiry is never already expired", () => {
  assert.equal(isTokenExpired(tokenExpiryFrom(NOW), NOW), false);
});

// --- migration-not-run detection -------------------------------------------

test("Postgres and PostgREST missing-column codes are recognised, nothing else is", () => {
  assert.equal(isMissingColumnError({ code: "42703" }), true);
  assert.equal(isMissingColumnError({ code: "PGRST204" }), true);
  assert.equal(isMissingColumnError({ code: "PGRST205" }), false); // a missing TABLE, different problem
  assert.equal(isMissingColumnError({ code: "23505" }), false);
  assert.equal(isMissingColumnError(null), false);
  assert.equal(isMissingColumnError(undefined), false);
});
