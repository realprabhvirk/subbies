import test from "node:test";
import assert from "node:assert/strict";

import {
  daysUntilExpiry,
  planReminders,
  groupByContractor,
  sentKey,
  OVERDUE,
  type ReminderCandidate,
  type SentReminder,
} from "./expiry-logic.ts";

const T = (iso: string) => new Date(iso);

// --- date boundaries --------------------------------------------------------

test("expiry today is 0 days, not 1 or -1", () => {
  assert.equal(daysUntilExpiry("2026-06-15", T("2026-06-15T00:00:00Z")), 0);
  // Same calendar day, late in the day UTC — still 0, not -1.
  assert.equal(daysUntilExpiry("2026-06-15", T("2026-06-15T23:59:59Z")), 0);
});

test("tomorrow is 1, yesterday is -1", () => {
  assert.equal(daysUntilExpiry("2026-06-16", T("2026-06-15T12:00:00Z")), 1);
  assert.equal(daysUntilExpiry("2026-06-14", T("2026-06-15T00:00:00Z")), -1);
});

test("the cron's real 21:00 UTC run time does not drift the day count", () => {
  // The job runs at 21:00 UTC. A naive local-time implementation on a
  // non-UTC host is exactly where an off-by-one would appear.
  assert.equal(daysUntilExpiry("2026-06-15", T("2026-06-15T21:00:00Z")), 0);
  assert.equal(daysUntilExpiry("2026-07-15", T("2026-06-15T21:00:00Z")), 30);
});

test("month, year and leap-day boundaries are exact", () => {
  assert.equal(daysUntilExpiry("2026-07-01", T("2026-06-30T00:00:00Z")), 1);
  assert.equal(daysUntilExpiry("2027-01-01", T("2026-12-31T00:00:00Z")), 1);
  assert.equal(daysUntilExpiry("2028-03-01", T("2028-02-28T00:00:00Z")), 2); // 2028 is a leap year
  assert.equal(daysUntilExpiry("2026-03-01", T("2026-02-28T00:00:00Z")), 1); // 2026 is not
});

test("a malformed or empty date returns null rather than a guess", () => {
  assert.equal(daysUntilExpiry("", T("2026-06-15T00:00:00Z")), null);
  assert.equal(daysUntilExpiry("15/06/2026", T("2026-06-15T00:00:00Z")), null);
  assert.equal(daysUntilExpiry("2026-06", T("2026-06-15T00:00:00Z")), null);
});

// --- threshold selection ----------------------------------------------------

const doc = (over: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  documentId: "doc1",
  contractorId: "con1",
  documentName: "Public liability",
  reminderDays: [30, 14, 7],
  expiryDate: "2026-07-15",
  ...over,
});

const NOW = T("2026-06-15T21:00:00Z"); // 30 days before 2026-07-15

test("a document exactly at its largest threshold fires once", () => {
  const out = planReminders([doc()], [], NOW);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].thresholds, ["30"]);
  assert.equal(out[0].daysLeft, 30);
  assert.equal(out[0].overdue, false);
});

test("a document not yet inside any window fires nothing", () => {
  const out = planReminders([doc({ expiryDate: "2026-08-15" })], [], NOW);
  assert.deepEqual(out, []);
});

test("a document type with reminders switched off never nags before expiry", () => {
  const out = planReminders([doc({ reminderDays: [] })], [], NOW);
  assert.deepEqual(out, []);
});

test("the email reports real days left, not the threshold it is filed under", () => {
  // 29 days out: inside the 30 window, but the customer should read "29".
  const out = planReminders([doc()], [], T("2026-06-16T21:00:00Z"));
  assert.equal(out[0].daysLeft, 29);
  assert.deepEqual(out[0].thresholds, ["30"]);
});

test("a missed run catches up rather than stepping over the window forever", () => {
  // The job didn't run for three days; we're now at 27 days out and the
  // 30-day reminder was never sent. It should still go.
  const out = planReminders([doc()], [], T("2026-06-18T21:00:00Z"));
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].thresholds, ["30"]);
});

test("approved with an expiry already inside several windows sends ONE email and burns the rest", () => {
  // 5 days left on a 30/14/7 schedule: one email about 5 days, and 30/14/7
  // all consumed so none of them can fire again tomorrow.
  const out = planReminders([doc({ expiryDate: "2026-06-20" })], [], NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].daysLeft, 5);
  assert.deepEqual(out[0].thresholds, ["30", "14", "7"]);
});

// --- idempotency ------------------------------------------------------------

test("a threshold already sent for this expiry does not fire again", () => {
  const sent: SentReminder[] = [
    { documentId: "doc1", expiryDate: "2026-07-15", threshold: "30" },
  ];
  assert.deepEqual(planReminders([doc()], sent, NOW), []);
});

test("running twice over the same data produces nothing the second time", () => {
  const first = planReminders([doc()], [], NOW);
  const log: SentReminder[] = first.flatMap((d) =>
    d.thresholds.map((t) => ({
      documentId: d.documentId,
      expiryDate: d.expiryDate,
      threshold: t,
    })),
  );
  assert.equal(first.length, 1);
  assert.deepEqual(planReminders([doc()], log, NOW), []);
});

test("RENEWAL: a new expiry date starts a fresh reminder cycle on the same document row", () => {
  // The bug this guards. Documents are updated in place — renewing reuses
  // the same row id with a later expiry_date. Keyed on document alone, last
  // year's "30" would suppress this year's 30-day reminder permanently.
  const sent: SentReminder[] = [
    { documentId: "doc1", expiryDate: "2026-07-15", threshold: "30" },
  ];
  const renewed = doc({ expiryDate: "2027-07-15" });
  const out = planReminders([renewed], sent, T("2027-06-15T21:00:00Z"));
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].thresholds, ["30"]);
});

test("a later threshold still fires after an earlier one was sent", () => {
  const sent: SentReminder[] = [
    { documentId: "doc1", expiryDate: "2026-07-15", threshold: "30" },
  ];
  const out = planReminders([doc()], sent, T("2026-07-01T21:00:00Z")); // 14 days out
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].thresholds, ["14"]);
  assert.equal(out[0].daysLeft, 14);
});

// --- overdue escalation -----------------------------------------------------

test("a lapsed document escalates once, regardless of schedule", () => {
  const out = planReminders([doc({ expiryDate: "2026-06-14" })], [], NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].overdue, true);
  assert.equal(out[0].daysLeft, -1);
  assert.deepEqual(out[0].thresholds, [OVERDUE]);
});

test("a lapsed document escalates even with reminders switched off", () => {
  const out = planReminders(
    [doc({ expiryDate: "2026-06-14", reminderDays: [] })],
    [],
    NOW,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].overdue, true);
});

test("the overdue escalation is sent once, not daily forever", () => {
  const sent: SentReminder[] = [
    { documentId: "doc1", expiryDate: "2026-06-14", threshold: OVERDUE },
  ];
  const out = planReminders([doc({ expiryDate: "2026-06-14" })], sent, NOW);
  assert.deepEqual(out, []);
});

test("expiring today is a pre-expiry reminder, not an escalation", () => {
  const out = planReminders([doc({ expiryDate: "2026-06-15" })], [], NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].overdue, false);
  assert.equal(out[0].daysLeft, 0);
});

// --- batching ---------------------------------------------------------------

test("two documents due for one contractor group into a single email", () => {
  const out = planReminders(
    [
      doc({ documentId: "d1", documentName: "Public liability" }),
      doc({ documentId: "d2", documentName: "Workers comp" }),
    ],
    [],
    NOW,
  );
  assert.equal(out.length, 2);
  const grouped = groupByContractor(out);
  assert.equal(grouped.size, 1);
  assert.equal(grouped.get("con1")?.length, 2);
});

test("documents for different contractors stay in separate emails", () => {
  const out = planReminders(
    [
      doc({ documentId: "d1", contractorId: "con1" }),
      doc({ documentId: "d2", contractorId: "con2" }),
    ],
    [],
    NOW,
  );
  assert.equal(groupByContractor(out).size, 2);
});

test("sentKey separates document, expiry and threshold", () => {
  assert.notEqual(sentKey("d", "2026-07-15", "30"), sentKey("d", "2027-07-15", "30"));
  assert.notEqual(sentKey("d", "2026-07-15", "30"), sentKey("d", "2026-07-15", "14"));
});
