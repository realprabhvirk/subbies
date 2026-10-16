import test from "node:test";
import assert from "node:assert/strict";

import {
  COMPLIANCE_TIMEZONE,
  complianceTodayISO,
  complianceToday,
  complianceTodayUtcMs,
} from "./compliance-today.ts";
import { daysUntilExpiry, describeExpiry } from "../reminders/expiry-logic.ts";

const at = (iso: string) => new Date(iso);

test("the timezone is Queensland", () => {
  assert.equal(COMPLIANCE_TIMEZONE, "Australia/Brisbane");
});

test("at the 21:00 UTC cron time, 'today' is already the next day in Queensland", () => {
  // 2026-10-14T21:00Z is 2026-10-15 07:00 in Brisbane (UTC+10).
  assert.equal(complianceTodayISO(at("2026-10-14T21:00:00Z")), "2026-10-15");
});

test("just before midnight Queensland is still the same QLD date (not the UTC one)", () => {
  // 2026-10-15T13:59Z = 2026-10-15 23:59 Brisbane; UTC date is the 15th too here,
  // but 2026-10-15T14:30Z = 2026-10-16 00:30 Brisbane -> rolls to the 16th.
  assert.equal(complianceTodayISO(at("2026-10-15T13:59:00Z")), "2026-10-15");
  assert.equal(complianceTodayISO(at("2026-10-15T14:30:00Z")), "2026-10-16");
});

test("complianceToday feeds daysUntilExpiry the right calendar date at cron time", () => {
  const cron = at("2026-10-14T21:00:00Z"); // 7am QLD on the 15th
  const today = complianceToday(cron);
  // A document expiring on the 15th is expiring TODAY (0), not "1 day left".
  assert.equal(daysUntilExpiry("2026-10-15", today), 0);
  // One that expired on the 14th is overdue by 1, not "0".
  assert.equal(daysUntilExpiry("2026-10-14", today), -1);
  // 30 / 7 / 1 day thresholds land exactly.
  assert.equal(daysUntilExpiry("2026-11-14", today), 30);
  assert.equal(daysUntilExpiry("2026-10-22", today), 7);
  assert.equal(daysUntilExpiry("2026-10-16", today), 1);
});

test("describeExpiry via complianceToday reads 'today' and 'expired' correctly at cron time", () => {
  const today = complianceToday(at("2026-10-14T21:00:00Z"));
  assert.deepEqual(describeExpiry("2026-10-15", today), { tone: "soon", detail: "today" });
  assert.equal(describeExpiry("2026-10-14", today)?.tone, "expired");
  assert.equal(describeExpiry("2026-10-16", today)?.detail, "1 day left");
});

test("complianceTodayUtcMs is UTC midnight of the QLD date (for < comparisons)", () => {
  const ms = complianceTodayUtcMs(at("2026-10-14T21:00:00Z"));
  assert.equal(new Date(ms).toISOString(), "2026-10-15T00:00:00.000Z");
  // A doc expiring on the QLD 'today' is NOT yet before today -> not expired.
  assert.equal(new Date("2026-10-15T00:00:00Z").getTime() < ms, false);
  // Yesterday's QLD date IS before today -> expired.
  assert.equal(new Date("2026-10-14T00:00:00Z").getTime() < ms, true);
});

test("month and year boundaries roll at QLD midnight, not UTC", () => {
  // 2026-10-31T14:30Z = 2026-11-01 00:30 Brisbane.
  assert.equal(complianceTodayISO(at("2026-10-31T14:30:00Z")), "2026-11-01");
  // 2026-12-31T14:30Z = 2027-01-01 Brisbane.
  assert.equal(complianceTodayISO(at("2026-12-31T14:30:00Z")), "2027-01-01");
});
