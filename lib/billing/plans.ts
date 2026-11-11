/**
 * Plan configuration: the single source of truth for prices, limits and
 * features. Prices are AUD/month, confirmed final by the founder. Price IDs
 * come from env (server-only, never exposed to the client).
 *
 * Limits are enforced at creation time, twice: a friendly pre-check in
 * TypeScript (lib/billing/entitlements.ts) and the authoritative, race-safe
 * check in SQL (subbies_assert_can_add). lib/billing/plan-limits-sql.test.ts
 * fails if the two disagree. Limits apply from the first day of the trial.
 *
 * Downgrades never delete anything: a company over its new limit keeps every
 * row and simply can't add more until it's back under (D7). Archived
 * contractors and completed projects don't count (D8).
 *
 * Pure and dependency-free so it runs under plain `node --test`, and safe to
 * import from client components (no env reads at module load).
 */
import type { SubscriptionStatus } from "@/lib/types";
import { statusHasAccess } from "./access-statuses.ts";

export type PlanId = "starter" | "business" | "pro";

export interface PlanLimits {
  /** null = unlimited, 0 = not included in the plan */
  contractors: number | null;
  documentTypes: number | null;
  projects: number | null;
}

/** The resources counted against a plan in the database. */
export type LimitedResource = keyof PlanLimits;

/**
 * Everything limitFor() answers. `seats` and `photos` are config only until
 * their phases ship (team and photos); nothing counts them yet.
 */
export type LimitResource = LimitedResource | "seats" | "photos";

/**
 * Gated features. A feature belongs to the cheapest plan that has it and
 * every plan above. Listed here before they ship so the gate exists first;
 * marketing only shows what has shipped (see `features` / `comingSoon`).
 */
export type PlanFeature =
  // All plans
  | "projectCompliance"
  | "map"
  | "photos"
  // Business and up
  | "requirements"
  | "documentRegister"
  | "activityView"
  | "pdfExport"
  // Pro
  | "analytics"
  | "team"
  | "bulkTools"
  | "auditExports"
  | "prioritySupport";

export interface PlanConfig {
  id: PlanId;
  name: string;
  amount: number; // AUD/month
  priceIdEnv: string;
  blurb: string;
  /** Marketing tag on the featured plan, or null. */
  tag: string | null;
  featured: boolean;
  limits: PlanLimits;
  /** Team members including the owner (D9: Pro is capped at 10). */
  seats: number;
  /** Photos per item (D3). Same on every plan. */
  photos: number;
  /** Shipped, true today. Shown on pricing, onboarding and billing. */
  features: string[];
  /** Announced but not shipped. Only ever rendered with a "Coming soon" label. */
  comingSoon: string[];
}

const PLAN_ORDER: readonly PlanId[] = ["starter", "business", "pro"];

/** The cheapest plan that includes each feature. */
export const FEATURE_MIN_PLAN: Record<PlanFeature, PlanId> = {
  projectCompliance: "starter",
  map: "starter",
  photos: "starter",
  requirements: "business",
  documentRegister: "business",
  activityView: "business",
  pdfExport: "business",
  analytics: "pro",
  team: "pro",
  bulkTools: "pro",
  auditExports: "pro",
  prioritySupport: "pro",
};

/** Plain-English feature names, for upgrade prompts. */
export const FEATURE_LABEL: Record<PlanFeature, string> = {
  projectCompliance: "Project compliance",
  map: "Project map",
  photos: "Photos",
  requirements: "Project requirements",
  documentRegister: "Document register",
  activityView: "Activity history",
  pdfExport: "PDF reports",
  analytics: "Analytics",
  team: "Team members (up to 10)",
  bulkTools: "Bulk tools",
  auditExports: "Audit exports",
  prioritySupport: "Priority support",
};

/**
 * Gated features that are live today. Everything else is "Coming soon" in
 * marketing and is never sold as available. Each later phase adds its
 * feature here when it ships.
 */
export const SHIPPED_FEATURES: readonly PlanFeature[] = ["projectCompliance"];

export function isShipped(feature: PlanFeature): boolean {
  return SHIPPED_FEATURES.includes(feature);
}

/** Unshipped features that first appear on this plan, by label. */
function comingSoonAt(plan: PlanId): string[] {
  return (Object.keys(FEATURE_MIN_PLAN) as PlanFeature[])
    .filter((f) => FEATURE_MIN_PLAN[f] === plan && !isShipped(f))
    .map((f) => FEATURE_LABEL[f]);
}

/** Plural nouns for limit copy, e.g. "5 contractors". */
export const RESOURCE_NOUN: Record<LimitResource, { one: string; many: string }> = {
  contractors: { one: "contractor", many: "contractors" },
  documentTypes: { one: "document type", many: "document types" },
  projects: { one: "project", many: "projects" },
  seats: { one: "team member", many: "team members" },
  photos: { one: "photo", many: "photos" },
};

/** "5 contractors", "1 project", "Unlimited projects". */
export function limitLine(limit: number | null, resource: LimitResource): string {
  const noun = RESOURCE_NOUN[resource];
  if (limit === null) return `Unlimited ${noun.many}`;
  return `${limit} ${limit === 1 ? noun.one : noun.many}`;
}

const STARTER_LIMITS: PlanLimits = { contractors: 5, documentTypes: 7, projects: 1 };
const BUSINESS_LIMITS: PlanLimits = { contractors: 25, documentTypes: 15, projects: 10 };
const PRO_LIMITS: PlanLimits = { contractors: null, documentTypes: null, projects: null };

function limitFeatures(limits: PlanLimits): string[] {
  return [
    limitLine(limits.contractors, "contractors"),
    limitLine(limits.documentTypes, "documentTypes"),
    limitLine(limits.projects, "projects"),
  ];
}

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  starter: {
    id: "starter",
    name: "Starter",
    amount: 19,
    priceIdEnv: "STRIPE_PRICE_STARTER",
    blurb: "For smaller operators bringing on a handful of contractors.",
    tag: null,
    featured: false,
    limits: STARTER_LIMITS,
    seats: 1,
    photos: 3,
    features: [
      ...limitFeatures(STARTER_LIMITS),
      "Secure upload links",
      "Review, approve and reject",
      "Expiry reminders",
      "Compliance status per project",
    ],
    comingSoon: comingSoonAt("starter"),
  },
  business: {
    id: "business",
    name: "Business",
    amount: 39,
    priceIdEnv: "STRIPE_PRICE_BUSINESS",
    blurb: "For established builders running multiple jobs at once.",
    tag: "Best for growing builders",
    featured: true,
    limits: BUSINESS_LIMITS,
    seats: 1,
    photos: 3,
    features: [...limitFeatures(BUSINESS_LIMITS), "Everything in Starter"],
    comingSoon: comingSoonAt("business"),
  },
  pro: {
    id: "pro",
    name: "Pro",
    amount: 79,
    priceIdEnv: "STRIPE_PRICE_PRO",
    blurb: "For larger teams and higher contractor turnover.",
    tag: null,
    featured: false,
    limits: PRO_LIMITS,
    seats: 10,
    photos: 3,
    features: [...limitFeatures(PRO_LIMITS), "Everything in Business"],
    comingSoon: comingSoonAt("pro"),
  },
};

/** Kept for the ~15 existing imports. Same object as PLAN_CONFIG. */
export const PLANS = PLAN_CONFIG;

export const PLAN_IDS: readonly PlanId[] = PLAN_ORDER;

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

// Entitlement helpers ---------------------------------------------------------

function rank(plan: PlanId): number {
  return PLAN_ORDER.indexOf(plan);
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_ORDER as readonly string[]).includes(value);
}

/**
 * A plan's limit for one resource. null = unlimited, 0 = not included. No
 * plan (pre-onboarding, unknown price) gets 0: nothing is creatable. Access
 * (lapsed or not) is checked separately, in checkLimit().
 */
export function limitFor(plan: PlanId | null | undefined, resource: LimitResource): number | null {
  if (!plan || !isPlanId(plan)) return 0;
  const config = PLAN_CONFIG[plan];
  if (resource === "seats") return config.seats;
  if (resource === "photos") return config.photos;
  return config.limits[resource];
}

/** Does this plan include the feature? No plan includes nothing. */
export function can(plan: PlanId | null | undefined, feature: PlanFeature): boolean {
  if (!plan || !isPlanId(plan)) return false;
  return rank(plan) >= rank(FEATURE_MIN_PLAN[feature]);
}

/**
 * The cheapest plan above `current` that would let a company with `used`
 * rows add one more. null when no plan would (already unlimited, or the
 * resource is the same everywhere).
 */
export function planToAdd(
  current: PlanId | null | undefined,
  resource: LimitResource,
  used: number,
): PlanId | null {
  const from = current && isPlanId(current) ? rank(current) + 1 : 0;
  for (const plan of PLAN_ORDER.slice(from)) {
    const limit = limitFor(plan, resource);
    if (limit === null || used < limit) return plan;
  }
  return null;
}

/**
 * The typed error the server returns when a plan blocks something. The UI
 * renders an UpgradePrompt from it; it never decides entitlement itself.
 */
export type PlanError =
  | {
      code: "PLAN_LIMIT";
      resource: LimitResource;
      requiredPlan: PlanId | null;
      currentPlan: PlanId | null;
      limit: number | null;
      used: number;
    }
  | {
      code: "PLAN_FEATURE";
      feature: PlanFeature;
      requiredPlan: PlanId;
      currentPlan: PlanId | null;
    };

export function featureError(plan: PlanId | null | undefined, feature: PlanFeature): PlanError | null {
  if (can(plan, feature)) return null;
  return {
    code: "PLAN_FEATURE",
    feature,
    requiredPlan: FEATURE_MIN_PLAN[feature],
    currentPlan: plan && isPlanId(plan) ? plan : null,
  };
}

export interface LimitCheck {
  allowed: boolean;
  used: number;
  limit: number | null;
  /** true when blocked because access has lapsed rather than a count cap. */
  accessLapsed: boolean;
  /** Set when the plan (not lapsed access) is what blocks the create. */
  planError: PlanError | null;
}

/**
 * The whole creation rule in one pure function: lapsed access blocks
 * everything; otherwise the plan's limit applies to the live count. Trialing
 * and past_due have access with their plan's limits. Over the limit (after a
 * downgrade) is simply "not allowed", never an error state.
 */
export function checkLimit(input: {
  plan: PlanId | null | undefined;
  status: SubscriptionStatus | null | undefined;
  resource: LimitResource;
  used: number;
}): LimitCheck {
  const plan = input.plan && isPlanId(input.plan) ? input.plan : null;
  const hasAccess = statusHasAccess(input.status);
  const limit = hasAccess ? limitFor(plan, input.resource) : 0;
  const used = input.used;

  if (!hasAccess) {
    return { allowed: false, used, limit: limitFor(plan, input.resource), accessLapsed: true, planError: null };
  }
  const allowed = limit === null || used < limit;
  return {
    allowed,
    used,
    limit,
    accessLapsed: false,
    planError: allowed
      ? null
      : {
          code: "PLAN_LIMIT",
          resource: input.resource,
          requiredPlan: planToAdd(plan, input.resource, used),
          currentPlan: plan,
          limit,
          used,
        },
  };
}
