/**
 * Plan configuration. Prices are AUD/month, confirmed final by the founder.
 * Price IDs come from env (server-only — never expose to the client).
 *
 * Contractor / document-type / project limits are enforced at creation time
 * (see lib/billing/entitlements.ts). The document-storage figure is a
 * marketing number only — not enforced in-app; the real near-term constraint
 * is Supabase's project-wide storage cap.
 */

export type PlanId = "starter" | "business" | "pro";

export interface PlanLimits {
  /** null = unlimited */
  contractors: number | null;
  documentTypes: number | null;
  projects: number | null;
}

export type LimitedResource = keyof PlanLimits;

export interface PlanConfig {
  id: PlanId;
  name: string;
  amount: number; // AUD/month
  priceIdEnv: string;
  blurb: string;
  featured: boolean;
  limits: PlanLimits;
  /** Marketing display only — not enforced. */
  storageMarketing: number | null;
  features: string[];
}

export const PLANS: Record<PlanId, PlanConfig> = {
  starter: {
    id: "starter",
    name: "Starter",
    amount: 19,
    priceIdEnv: "STRIPE_PRICE_STARTER",
    blurb: "For smaller operators bringing on a handful of contractors.",
    featured: false,
    limits: { contractors: 5, documentTypes: 7, projects: 10 },
    storageMarketing: 200,
    features: [
      "5 contractors",
      "7 document types",
      "10 projects",
      "Secure upload links",
      "Review, approve & reject",
      "Expiry reminders",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    amount: 39,
    priceIdEnv: "STRIPE_PRICE_BUSINESS",
    blurb: "For established builders running multiple jobs at once.",
    featured: true,
    limits: { contractors: 25, documentTypes: 15, projects: null },
    storageMarketing: 750,
    features: [
      "25 contractors",
      "15 document types",
      "Unlimited projects",
      "Everything in Starter",
      "Compliance status per project",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    amount: 79,
    priceIdEnv: "STRIPE_PRICE_PRO",
    blurb: "For larger teams and higher contractor turnover.",
    featured: false,
    limits: { contractors: null, documentTypes: null, projects: null },
    storageMarketing: null,
    features: [
      "Unlimited contractors",
      "Unlimited document types",
      "Unlimited projects",
      "Everything in Business",
    ],
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

/**
 * Every plan is chosen at onboarding via Stripe Checkout with a 7-day trial —
 * card required upfront, $0 during the trial, converts to a real charge on
 * day 7 unless cancelled.
 */
export const TRIAL_DAYS = 7;

/**
 * Limits applied when a company somehow has no active plan (e.g. a lapsed
 * subscription rendering a page before the layout's soft-lock kicks in). The
 * creation guards already block when access has lapsed, so this is only a
 * safe floor — use the smallest plan's limits.
 */
export const FALLBACK_LIMITS: PlanLimits = PLANS.starter.limits;

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
