import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldSkipTrial,
  emailUsedTrialFromLookup,
} from "./trial-eligibility-policy.ts";

test("re-signup after deletion (same email, fresh company) skips the trial", () => {
  // No subscription on the new company yet — it's brand new — but the email
  // itself already burned a trial on the account that got deleted.
  assert.equal(
    shouldSkipTrial({ hadSubscriptionBefore: false, emailUsedTrialBefore: true }),
    true,
  );
});

test("a completely different email with no history gets a normal trial", () => {
  assert.equal(
    shouldSkipTrial({ hadSubscriptionBefore: false, emailUsedTrialBefore: false }),
    false,
  );
});

test("existing cancel-and-resubscribe protection still holds, unrelated to the ledger", () => {
  // Same company, never deleted, just cancelled and come back — this is the
  // pre-existing hadSubscriptionBefore check, untouched by the new ledger.
  assert.equal(
    shouldSkipTrial({ hadSubscriptionBefore: true, emailUsedTrialBefore: false }),
    true,
  );
});

test("both signals true is still just a skip", () => {
  assert.equal(
    shouldSkipTrial({ hadSubscriptionBefore: true, emailUsedTrialBefore: true }),
    true,
  );
});

// --- Regression: the ledger lookup failing must not block everyone -------
//
// This is the exact bug that shipped: migration 0009 hadn't been run, so
// every lookup errored with PGRST205, the old code read that error as
// "assume they've used a trial", and every brand-new signup silently lost
// its 7 days. These lock in the fail-OPEN direction.

test("a failed ledger lookup does NOT count as having used a trial", () => {
  assert.equal(emailUsedTrialFromLookup({ found: false, lookupFailed: true }), false);
});

test("a failed lookup fails open even if `found` came back garbage-true", () => {
  // `found` carries no information when the query errored — it must be ignored,
  // not trusted, so a truthy value can't leak through as a block.
  assert.equal(emailUsedTrialFromLookup({ found: true, lookupFailed: true }), false);
});

test("a successful lookup with no row means no trial used", () => {
  assert.equal(emailUsedTrialFromLookup({ found: false, lookupFailed: false }), false);
});

test("a successful lookup that finds the row does block the trial", () => {
  assert.equal(emailUsedTrialFromLookup({ found: true, lookupFailed: false }), true);
});

test("end to end: fresh email + broken ledger still gets its trial", () => {
  // The full decision path for a brand-new company whose ledger lookup blew up.
  const emailUsedTrialBefore = emailUsedTrialFromLookup({
    found: false,
    lookupFailed: true,
  });
  assert.equal(
    shouldSkipTrial({ hadSubscriptionBefore: false, emailUsedTrialBefore }),
    false,
  );
});

test("end to end: a genuinely deleted email is still blocked when the ledger works", () => {
  const emailUsedTrialBefore = emailUsedTrialFromLookup({
    found: true,
    lookupFailed: false,
  });
  assert.equal(
    shouldSkipTrial({ hadSubscriptionBefore: false, emailUsedTrialBefore }),
    true,
  );
});
