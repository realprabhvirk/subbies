/**
 * Plan configuration. Prices are AUD/month, confirmed final by the founder.
 * Price IDs come from env (server-only — never expose to the client).
 *
 * Contractor / document-type / project limits are enforced at creation time
 * (see lib/billing/entitlements.ts) and apply from the first day of the plan's
 * trial — there is no separate, smaller free-tier cap. The document-storage figure is a
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
 * Free trial length, in days, attached to whichever plan the company picks.
 *
 * There is no separate card-free tier: every account goes through Stripe
 * Checkout at onboarding, is charged A$0 for TRIAL_DAYS days, and converts to
 * the plan's real price on day TRIAL_DAYS unless it is cancelled first. The
 * chosen plan's real limits apply from day one of the trial.
 */
export const TRIAL_DAYS = 7;

/**
 * The configured Stripe Price ID for a plan, or null if the env var is unset
 * or blank.
 *
 * Trimmed deliberately: a Price ID pasted into a dashboard env field with a
 * trailing space or newline is indistinguishable from a correct one by eye,
 * but Stripe rejects it with `resource_missing`.
 */
export function priceIdForPlan(plan: PlanId): string | null {
  const id = process.env[PLANS[plan].priceIdEnv]?.trim();
  return id ? id : null;
}

export function planForPriceId(priceId: string): PlanId | null {
  for (const plan of PLAN_IDS) {
    if (priceIdForPlan(plan) === priceId) return plan;
  }
  return null;
}
