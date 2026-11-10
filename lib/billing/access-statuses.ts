import type { SubscriptionStatus } from "@/lib/types";

/**
 * The subscription statuses that give a company live access to Subbies.
 *
 * past_due is included on purpose: Stripe is still retrying the card, and
 * cutting a company off mid-retry is the wrong failure for a compliance tool.
 *
 * The database has the same rule in public.subbies_company_has_access
 * (migration 0020). lib/billing/plan-limits-sql.test.ts checks the two agree.
 *
 * Pure and dependency-free so it runs under plain `node --test`.
 */
export const ACCESS_STATUSES: readonly SubscriptionStatus[] = ["trialing", "active", "past_due"];

export function statusHasAccess(status: SubscriptionStatus | null | undefined): boolean {
  return status != null && ACCESS_STATUSES.includes(status);
}
