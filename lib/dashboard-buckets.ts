import type { ContractorStatus, DocumentStatus } from "@/lib/types";

/**
 * How the dashboard sorts contractors into its four figures. This is the exact
 * classification the page used inline before the v4 pass, lifted out so the
 * stat tiles, the donut and the contractors-list filter all agree and so it can
 * be tested. Pure: no clock (the caller passes `todayMs`), no database.
 *
 * `todayMs` is UTC midnight of today's Queensland date (complianceTodayUtcMs).
 */

export const EXPIRING_WINDOW_DAYS = 30;

export interface BucketContractor {
  id: string;
  status: ContractorStatus;
}

export interface BucketDoc {
  contractor_id: string;
  status: DocumentStatus;
  expiry_date: string | null;
}

export interface ContractorBuckets {
  expiredIds: Set<string>;
  expiringIds: Set<string>;
  /** Contractors with status approved that aren't expired (still includes those expiring soon). */
  approvedCount: number;
  /** pending, awaiting_review or attention_required. */
  pendingCount: number;
  /**
   * The same contractors counted exactly once, worst status wins:
   * expired, then expiring soon, then pending onboarding, then approved. These
   * four always add up to the roster size, which is what a donut needs.
   */
  exclusive: { approved: number; pending: number; expiring: number; expired: number };
}

const PENDING_STATUSES: ContractorStatus[] = ["pending", "awaiting_review", "attention_required"];

export function bucketContractors(input: {
  contractors: BucketContractor[];
  docs: BucketDoc[];
  todayMs: number;
  windowDays?: number;
}): ContractorBuckets {
  const { contractors, docs, todayMs } = input;
  const windowEnd = todayMs + (input.windowDays ?? EXPIRING_WINDOW_DAYS) * 86_400_000;

  const expiringIds = new Set<string>();
  const expiredIds = new Set<string>();
  for (const doc of docs) {
    if (doc.status !== "approved" || !doc.expiry_date) continue;
    const expiry = new Date(doc.expiry_date + "T00:00:00Z").getTime();
    if (expiry < todayMs) expiredIds.add(doc.contractor_id);
    else if (expiry <= windowEnd) expiringIds.add(doc.contractor_id);
  }
  for (const c of contractors) {
    if (c.status === "expired") expiredIds.add(c.id);
  }
  // A contractor that's already expired shouldn't also count as expiring.
  for (const id of expiredIds) expiringIds.delete(id);

  const approvedCount = contractors.filter(
    (c) => c.status === "approved" && !expiredIds.has(c.id),
  ).length;
  const pendingCount = contractors.filter((c) => PENDING_STATUSES.includes(c.status)).length;

  const exclusive = { approved: 0, pending: 0, expiring: 0, expired: 0 };
  for (const c of contractors) {
    if (expiredIds.has(c.id)) exclusive.expired += 1;
    else if (expiringIds.has(c.id)) exclusive.expiring += 1;
    else if (PENDING_STATUSES.includes(c.status)) exclusive.pending += 1;
    else exclusive.approved += 1;
  }

  return { expiredIds, expiringIds, approvedCount, pendingCount, exclusive };
}
