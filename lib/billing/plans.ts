/**
 * Plan configuration. Prices are AUD/month, confirmed final by the founder.
 * Price IDs come from env (server-only — never expose to the client).
 *
 * Contractor limits are enforced at the point of adding a contractor.
 */

export type PlanId = "starter" | "business" | "pro";

export interface PlanConfig {
  id: PlanId;
  name: string;
  amount: number; // AUD/month
  /** null = unlimited */
  contractorLimit: number | null;
  priceIdEnv: string;
  blurb: string;
  features: string[];
}

export const PLANS: Record<PlanId, PlanConfig> = {
  starter: {
    id: "starter",
    name: "Starter",
    amount: 29,
    contractorLimit: 20,
    priceIdEnv: "STRIPE_PRICE_STARTER",
    blurb: "For smaller operators bringing on a handful of contractors.",
    features: [
      "Up to 20 contractors",
      "Unlimited document types",
      "Secure upload links",
      "Review, approve & reject",
      "Expiry reminders",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    amount: 49,
    contractorLimit: 75,
    priceIdEnv: "STRIPE_PRICE_BUSINESS",
    blurb: "For established builders running multiple jobs at once.",
    features: [
      "Up to 75 contractors",
      "Everything in Starter",
      "Projects & job assignment",
      "Compliance status per project",
      "Reminder escalation",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    amount: 99,
    contractorLimit: null,
    priceIdEnv: "STRIPE_PRICE_PRO",
    blurb: "For larger teams and higher contractor turnover.",
    features: [
      "Unlimited contractors",
      "Everything in Business",
      "Full activity history",
    ],
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export const TRIAL_DAYS = 14;

/**
 * Contractor allowance for a company with no active paid plan. Kept small so
 * the product is testable but not free forever, and so existing accounts
 * aren't broken. Set to 0 for pure paid-only.
 */
export const FREE_CONTRACTOR_LIMIT = 3;

export function priceIdForPlan(plan: PlanId): string {
  const id = process.env[PLANS[plan].priceIdEnv];
  if (!id) throw new Error(`Missing env ${PLANS[plan].priceIdEnv}`);
  return id;
}

export function planForPriceId(priceId: string): PlanId | null {
  for (const plan of PLAN_IDS) {
    if (process.env[PLANS[plan].priceIdEnv] === priceId) return plan;
  }
  return null;
}
