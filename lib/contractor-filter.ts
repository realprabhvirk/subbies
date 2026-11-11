/**
 * The status filter on the contractors list. The ids double as the `?status=`
 * values the dashboard stat tiles link to. The buckets themselves come from
 * lib/dashboard-buckets.ts, so a chip's count always equals the matching tile.
 */
export const CONTRACTOR_FILTERS = [
  { id: "all", label: "All" },
  { id: "approved", label: "Approved" },
  { id: "pending", label: "Pending onboarding" },
  { id: "expiring", label: "Expiring soon" },
  { id: "expired", label: "Expired" },
  // Not a dashboard bucket: archived contractors are off the register, and
  // this is the only place they're listed (D8).
  { id: "archived", label: "Archived" },
] as const;

export type ContractorFilter = (typeof CONTRACTOR_FILTERS)[number]["id"];

/** Anything that isn't a known filter id (or is repeated) means "all". */
export function parseContractorFilter(value: string | string[] | undefined): ContractorFilter {
  if (typeof value !== "string") return "all";
  return CONTRACTOR_FILTERS.some((f) => f.id === value) ? (value as ContractorFilter) : "all";
}
