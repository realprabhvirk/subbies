import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Subscription, SubscriptionStatus } from "@/lib/types";
import {
  PLANS,
  FREE_TIER,
  type PlanId,
  type PlanLimits,
  type LimitedResource,
} from "./plans";

export interface Entitlement {
  status: SubscriptionStatus;
  plan: PlanId | null;
  planName: string | null;

  /** The forced plan-selection screen has been passed. */
  onboardingCompleted: boolean;
  /** Redirect the user to /onboarding. */
  needsOnboarding: boolean;

  /** On the 7-day free tier, window still open. */
  onFreeTier: boolean;
  freeEndsAt: string | null;
  /** Free window has run out. */
  freeExpired: boolean;

  /** Paid access: trialing / active / past_due. */
  paidAccess: boolean;
  /** The product is usable right now (paid access or open free window). */
  hasAccess: boolean;
  /** Onboarded, but access has lapsed — show the soft-lock screen. */
  softLocked: boolean;

  /** Effective limits for creation checks. */
  limits: PlanLimits;

  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export const getSubscriptionRow = cache(
  async (companyId: string): Promise<Subscription | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle<Subscription>();
    return data ?? null;
  },
);

export const getEntitlement = cache(
  async (companyId: string): Promise<Entitlement> => {
    const sub = await getSubscriptionRow(companyId);
    const status: SubscriptionStatus = sub?.status ?? "none";
    const plan = sub?.plan ?? null;

    const onboardingCompleted = Boolean(sub?.onboarding_completed_at);
    const now = Date.now();
    const freeEndsAt = sub?.free_ends_at ?? null;

    const onFreeTier =
      status === "free" &&
      freeEndsAt !== null &&
      new Date(freeEndsAt).getTime() > now;
    const freeExpired =
      status === "free" &&
      (freeEndsAt === null || new Date(freeEndsAt).getTime() <= now);

    const paidAccess =
      status === "trialing" || status === "active" || status === "past_due";

    const hasAccess = paidAccess || onFreeTier;
    const needsOnboarding = !onboardingCompleted;
    const softLocked = onboardingCompleted && !hasAccess;

    const limits: PlanLimits =
      paidAccess && plan ? PLANS[plan].limits : FREE_TIER.limits;

    return {
      status,
      plan,
      planName: plan ? PLANS[plan].name : null,
      onboardingCompleted,
      needsOnboarding,
      onFreeTier,
      freeEndsAt,
      freeExpired,
      paidAccess,
      hasAccess,
      softLocked,
      limits,
      currentPeriodEnd: sub?.current_period_end ?? null,
      cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
      stripeCustomerId: sub?.stripe_customer_id ?? null,
      stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
    };
  },
);

const RESOURCE_TABLE: Record<LimitedResource, string> = {
  contractors: "contractors",
  documentTypes: "document_types",
  projects: "projects",
};

async function countResource(
  companyId: string,
  resource: LimitedResource,
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from(RESOURCE_TABLE[resource])
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  return count ?? 0;
}

export const getContractorCount = cache((companyId: string) =>
  countResource(companyId, "contractors"),
);

export const getUsageCounts = cache(
  async (
    companyId: string,
  ): Promise<Record<LimitedResource, number>> => {
    const [contractors, documentTypes, projects] = await Promise.all([
      countResource(companyId, "contractors"),
      countResource(companyId, "documentTypes"),
      countResource(companyId, "projects"),
    ]);
    return { contractors, documentTypes, projects };
  },
);

export interface LimitCheck {
  allowed: boolean;
  used: number;
  limit: number | null;
  /** true when blocked because access has lapsed rather than a count cap. */
  accessLapsed: boolean;
}

export async function checkResourceLimit(
  companyId: string,
  resource: LimitedResource,
): Promise<LimitCheck> {
  const [entitlement, used] = await Promise.all([
    getEntitlement(companyId),
    countResource(companyId, resource),
  ]);

  if (!entitlement.hasAccess) {
    return {
      allowed: false,
      used,
      limit: entitlement.limits[resource],
      accessLapsed: true,
    };
  }

  const limit = entitlement.limits[resource];
  return {
    allowed: limit === null || used < limit,
    used,
    limit,
    accessLapsed: false,
  };
}

export const canAddContractor = (companyId: string) =>
  checkResourceLimit(companyId, "contractors");
export const canAddDocumentType = (companyId: string) =>
  checkResourceLimit(companyId, "documentTypes");
export const canAddProject = (companyId: string) =>
  checkResourceLimit(companyId, "projects");

/** Consistent user-facing copy for a blocked create. */
export function limitMessage(check: LimitCheck, label: string): string {
  if (check.accessLapsed) {
    return `Your Subbies access has ended. Choose a plan in Settings → Billing to keep adding ${label}.`;
  }
  return `You've reached your ${check.limit} ${label} limit. Upgrade your plan in Settings → Billing to add more.`;
}
