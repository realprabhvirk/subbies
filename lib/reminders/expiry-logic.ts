/**
 * Pure decision logic for expiry reminders — no database, no email, no
 * "server-only", so it runs directly under `node --test` like every other
 * *-logic.ts in this repo.
 *
 * Everything that decides WHETHER an email goes out lives here. The route
 * does I/O and nothing else. Date arithmetic in particular is worth isolating:
 * it's the most likely thing to be subtly wrong, and the hardest to notice in
 * production (a one-day drift just looks like "the reminder came a bit late").
 */

/** Documents that have lapsed use this in place of a day count. */
export const OVERDUE = "overdue";

/** The idempotency bucket a sent reminder is recorded under. */
export type ReminderThreshold = string;

/**
 * Whole days from `today` until `expiryDate`, both read as calendar dates in
 * UTC. Negative once the date has passed, 0 on the day itself.
 *
 * Deliberately UTC-only and string-parsed rather than `new Date(str)` +
 * local-time maths. `expiry_date` is a Postgres `date` — a calendar day with
 * no time and no zone — and the existing app code reads it two different
 * ways: the dashboard does `new Date(d + "T00:00:00")` (local midnight),
 * lib/contractor-status.ts does `new Date(d)` (UTC midnight). On a Vercel
 * server both happen to be UTC so they agree today, but the second the
 * runtime's zone isn't UTC those two disagree by a day. Reminders decide when
 * a customer's email arrives, so this fixes the interpretation explicitly
 * instead of inheriting whatever the host's clock is set to.
 */
export function daysUntilExpiry(expiryDate: string, today: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expiryDate.trim());
  if (!m) return null;

  const expiryUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(expiryUtc)) return null;

  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );

  return Math.round((expiryUtc - todayUtc) / 86_400_000);
}

export type ExpiryTone = "expired" | "soon" | "ok";

export interface ExpiryStatus {
  tone: ExpiryTone;
  /** "12 days left", "Expires today", "3 days ago" — null when there's nothing worth saying. */
  detail: string | null;
}

/**
 * Matches the dashboard's "Expiring soon" tile, which counts anything within
 * 30 days (EXPIRING_WINDOW_DAYS in app/dashboard/page.tsx). Kept as its own
 * constant here so a badge on a contractor's page and that tile are read off
 * the same number.
 */
export const EXPIRING_SOON_DAYS = 30;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * How an approved document's expiry should read on the contractor page.
 * Built on daysUntilExpiry, so it agrees exactly with what the reminder job
 * will do about the same document on the same day.
 */
export function describeExpiry(
  expiryDate: string | null,
  today: Date,
): ExpiryStatus | null {
  if (!expiryDate) return null;
  const days = daysUntilExpiry(expiryDate, today);
  if (days === null) return null;

  if (days < 0) return { tone: "expired", detail: `${plural(-days, "day")} ago` };
  if (days === 0) return { tone: "soon", detail: "today" };
  if (days <= EXPIRING_SOON_DAYS) return { tone: "soon", detail: `${plural(days, "day")} left` };
  return { tone: "ok", detail: null };
}

export interface ReminderCandidate {
  documentId: string;
  contractorId: string;
  documentName: string;
  /** The document type's configured reminder_days. Empty means "no reminders". */
  reminderDays: number[];
  /** Postgres `date`, YYYY-MM-DD. */
  expiryDate: string;
}

export interface ReminderDecision {
  documentId: string;
  contractorId: string;
  documentName: string;
  expiryDate: string;
  /** Negative when already lapsed. */
  daysLeft: number;
  /** True once the expiry date has passed — escalates to the company instead. */
  overdue: boolean;
  /**
   * Every threshold this decision consumes. More than one when a document is
   * approved with an expiry already inside several windows (e.g. approved
   * with 5 days left on a 30/14/7 schedule): the customer gets ONE email
   * about the real days left, and the windows it skipped past are burned so
   * they can't fire retroactively tomorrow.
   */
  thresholds: ReminderThreshold[];
}

/** A reminder already sent — keyed by document AND the expiry it was about. */
export interface SentReminder {
  documentId: string;
  expiryDate: string;
  threshold: ReminderThreshold;
}

export function sentKey(
  documentId: string,
  expiryDate: string,
  threshold: ReminderThreshold,
): string {
  return `${documentId}|${expiryDate}|${threshold}`;
}

/**
 * Decides which documents are due a reminder right now.
 *
 * The threshold a reminder is filed under is bookkeeping only — the email
 * itself always states the real number of days left, so a reminder that runs
 * a day late reads correctly ("6 days left") rather than parroting its bucket
 * ("7 days left").
 *
 * Catch-up is intentional: a document is due whenever `daysLeft <= threshold`,
 * not only when the two are exactly equal. A cron that misses a day (outage,
 * deploy, cold start) would otherwise step straight over a threshold and never
 * mention it again.
 */
export function planReminders(
  candidates: ReminderCandidate[],
  alreadySent: SentReminder[],
  today: Date,
): ReminderDecision[] {
  const sent = new Set(
    alreadySent.map((s) => sentKey(s.documentId, s.expiryDate, s.threshold)),
  );

  const decisions: ReminderDecision[] = [];

  for (const c of candidates) {
    const daysLeft = daysUntilExpiry(c.expiryDate, today);
    if (daysLeft === null) continue; // unparseable date — never guess

    if (daysLeft < 0) {
      // Lapsed. One escalation per expiry date, regardless of the schedule:
      // a document type with reminders switched off still matters once it's
      // actually expired, and the company is the one who needs to know.
      const key = sentKey(c.documentId, c.expiryDate, OVERDUE);
      if (sent.has(key)) continue;
      decisions.push({
        documentId: c.documentId,
        contractorId: c.contractorId,
        documentName: c.documentName,
        expiryDate: c.expiryDate,
        daysLeft,
        overdue: true,
        thresholds: [OVERDUE],
      });
      continue;
    }

    // Every window this document has entered, largest first.
    const entered = c.reminderDays
      .filter((d) => Number.isInteger(d) && d > 0 && daysLeft <= d)
      .sort((a, b) => b - a);

    const pending = entered.filter(
      (d) => !sent.has(sentKey(c.documentId, c.expiryDate, String(d))),
    );
    if (pending.length === 0) continue;

    decisions.push({
      documentId: c.documentId,
      contractorId: c.contractorId,
      documentName: c.documentName,
      expiryDate: c.expiryDate,
      daysLeft,
      overdue: false,
      thresholds: pending.map(String),
    });
  }

  return decisions;
}

/** One email per contractor per run, not one per document. */
export function groupByContractor<T extends { contractorId: string }>(
  decisions: T[],
): Map<string, T[]> {
  const byContractor = new Map<string, T[]>();
  for (const d of decisions) {
    const list = byContractor.get(d.contractorId) ?? [];
    list.push(d);
    byContractor.set(d.contractorId, list);
  }
  return byContractor;
}
