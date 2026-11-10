import test from "node:test";
import assert from "node:assert/strict";

import { bucketContractors, type BucketContractor, type BucketDoc } from "./dashboard-buckets.ts";

const DAY = 86_400_000;
const TODAY = Date.parse("2026-11-10T00:00:00Z");
const on = (offsetDays: number) => new Date(TODAY + offsetDays * DAY).toISOString().slice(0, 10);

const c = (id: string, status: BucketContractor["status"]): BucketContractor => ({ id, status });
const d = (contractor_id: string, offset: number | null, status: BucketDoc["status"] = "approved"): BucketDoc => ({
  contractor_id,
  status,
  expiry_date: offset === null ? null : on(offset),
});

test("a document expiring today is expiring; yesterday is expired; day 30 is expiring; day 31 is not", () => {
  const r = bucketContractors({
    contractors: [c("a", "approved"), c("b", "approved"), c("c", "approved"), c("e", "approved")],
    docs: [d("a", 0), d("b", -1), d("c", 30), d("e", 31)],
    todayMs: TODAY,
  });
  assert.deepEqual([...r.expiringIds].sort(), ["a", "c"]);
  assert.deepEqual([...r.expiredIds], ["b"]);
});

test("an expired contractor is never also expiring, and a status of expired counts as expired", () => {
  const r = bucketContractors({
    contractors: [c("a", "approved"), c("x", "expired")],
    docs: [d("a", -5), d("a", 3), d("x", 3)],
    todayMs: TODAY,
  });
  assert.deepEqual([...r.expiredIds].sort(), ["a", "x"]);
  assert.equal(r.expiringIds.size, 0);
});

test("approved count excludes expired but includes expiring; pending covers three statuses", () => {
  const r = bucketContractors({
    contractors: [c("a", "approved"), c("b", "approved"), c("p", "pending"), c("r", "awaiting_review"), c("t", "attention_required")],
    docs: [d("a", -2), d("b", 10)],
    todayMs: TODAY,
  });
  assert.equal(r.approvedCount, 1);
  assert.equal(r.pendingCount, 3);
});

test("only approved documents with an expiry date count", () => {
  const r = bucketContractors({
    contractors: [c("a", "pending")],
    docs: [d("a", -10, "uploaded"), d("a", -10, "rejected"), d("a", null)],
    todayMs: TODAY,
  });
  assert.equal(r.expiredIds.size + r.expiringIds.size, 0);
});

test("exclusive buckets add up to the roster, worst status first", () => {
  const contractors = [
    c("ok1", "approved"), c("ok2", "approved"),
    c("soon", "approved"), c("late", "approved"), c("late2", "expired"),
    c("p1", "pending"), c("p2", "awaiting_review"),
    // pending contractor that also has a soon-expiring approved doc: counted once, as expiring
    c("both", "attention_required"),
  ];
  const r = bucketContractors({
    contractors,
    docs: [d("ok1", 200), d("soon", 12), d("late", -3), d("both", 5)],
    todayMs: TODAY,
  });
  assert.deepEqual(r.exclusive, { approved: 2, pending: 2, expiring: 2, expired: 2 });
  const sum = Object.values(r.exclusive).reduce((a, b) => a + b, 0);
  assert.equal(sum, contractors.length);
});

test("no contractors: everything zero", () => {
  const r = bucketContractors({ contractors: [], docs: [], todayMs: TODAY });
  assert.deepEqual(r.exclusive, { approved: 0, pending: 0, expiring: 0, expired: 0 });
  assert.equal(r.approvedCount + r.pendingCount, 0);
});
