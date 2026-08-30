import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Subscription, SubscriptionStatus } from "@/lib/types";
import { PLANS, FREE_CONTRACTOR_LIMIT, type PlanId } from "./plans";

export interface Entitlement {
  status: SubscriptionStatus;
  plan: PlanId | null;
  planName: string | null;
  /** trialing / active / past_due — the product is usable. */
  hasAccess: boolean;
  /** trialing / active — billing is healthy. */
  inGoodStanding: boolean;
  /** null = unlimited. */
  contractorLimit: number | null;
  trialEnd: string | null;
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

    const inGoodStanding = status === "trialing" || status === "active";
    const hasAccess = inGoodStanding || status === "past_due";

    const contractorLimit =
      hasAccess && plan ? PLANS[plan].contractorLimit : FREE_CONTRACTOR_LIMIT;

    return {
      status,
      plan,
      planName: plan ? PLANS[plan].name : null,
      hasAccess,
      inGoodStanding,
      contractorLimit,
      trialEnd: sub?.trial_end ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
      stripeCustomerId: sub?.stripe_customer_id ?? null,
      stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
    };
  },
);

export const getContractorCount = cache(
  async (companyId: string): Promise<number> => {
    const supabase = await createClient();
    const { count } = await supabase
      .from("contractors")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);
    return count ?? 0;
  },
);

export interface AddContractorCheck {
  allowed: boolean;
  used: number;
  limit: number | null;
}

export async function canAddContractor(
  companyId: string,
): Promise<AddContractorCheck> {
  const [entitlement, used] = await Promise.all([
    getEntitlement(companyId),
    getContractorCount(companyId),
  ]);
  const limit = entitlement.contractorLimit;
  return {
    allowed: limit === null || used < limit,
    used,
    limit,
  };
}
