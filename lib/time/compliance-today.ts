/**
 * "Today", for everything that decides compliance (is a document expired,
 * expiring soon, due for a reminder).
 *
 * Subbies serves Queensland builders. Expiry dates are plain calendar dates
 * (YYYY-MM-DD) with no time or zone, so "is this expired yet?" has to be asked
 * against the calendar date in Queensland, not in UTC. The bug this fixes: the
 * reminder cron runs at 21:00 UTC — already 7am the next day in Brisbane — so
 * computing "today" from the server's UTC clock put the whole product a day
 * out. A certificate expiring today read as "1 day left", and one that lapsed
 * yesterday read as "0".
 *
 * Queensland does not observe daylight saving, so the offset is a steady
 * UTC+10 all year; even so this derives the date from the IANA zone rather
 * than hardcoding +10, so it stays correct if the zone ever changes.
 *
 * Pure and dependency-free (just Intl) so it runs under plain `node --test`.
 */

/** The one place the compliance timezone is named. */
export const COMPLIANCE_TIMEZONE = "Australia/Brisbane";

const PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: COMPLIANCE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date in Queensland, as "YYYY-MM-DD". */
export function complianceTodayISO(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return PARTS.format(now);
}

/**
 * Today in Queensland as a Date whose UTC year/month/day are that calendar
 * date (UTC midnight of it). This is the value to pass to daysUntilExpiry /
 * describeExpiry, which read their `today` via getUTCFullYear/Month/Date.
 */
export function complianceToday(now: Date = new Date()): Date {
  const [y, m, d] = complianceTodayISO(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Epoch ms of UTC midnight of today's Queensland date — for < / <= compares. */
export function complianceTodayUtcMs(now: Date = new Date()): number {
  return complianceToday(now).getTime();
}
