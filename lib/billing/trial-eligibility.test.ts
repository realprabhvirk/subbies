import test from "node:test";
import assert from "node:assert/strict";

import { shouldSkipTrial } from "./trial-eligibility-policy.ts";

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
