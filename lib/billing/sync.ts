import "server-only";

import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionStatus } from "@/lib/types";
import { getStripe } from "./stripe";
import { planForPriceId } from "./plans";

function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "paused":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
      return "incomplete";
    default:
      return "incomplete";
  }
}

function toIso(secs: number | null | undefined): string | null {
  return secs ? new Date(secs * 1000).toISOString() : null;
}

export interface SyncResult {
  companyId: string | null;
  prevStatus: SubscriptionStatus | null;
  newStatus: SubscriptionStatus;
  plan: "starter" | "business" | "pro" | null;
  customerId: string;
}

/**
 * Writes the current state of a Stripe Subscription into our `subscriptions`
 * table. Idempotent — safe to call for every webhook retry. Stripe is the
 * source of truth; we only cache.
 */
export async function syncSubscription(
  sub: Stripe.Subscription,
): Promise<SyncResult> {
  const admin = createAdminClient();
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? null;
  const plan = priceId ? planForPriceId(priceId) : null;
  const status = mapStatus(sub.status);

  // Resolve which company this belongs to.
  let companyId: string | null =
    (sub.metadata?.company_id as string | undefined) ?? null;
  let prevStatus: SubscriptionStatus | null = null;

  const { data: bySub } = await admin
    .from("subscriptions")
    .select("company_id, status")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle<{ company_id: string; status: SubscriptionStatus }>();

  if (bySub) {
    companyId = bySub.company_id;
    prevStatus = bySub.status;
  } else {
    const { data: byCustomer } = await admin
      .from("subscriptions")
      .select("company_id, status")
      .eq("stripe_customer_id", customerId)
      .maybeSingle<{ company_id: string; status: SubscriptionStatus }>();
    if (byCustomer) {
      companyId = byCustomer.company_id;
      prevStatus = byCustomer.status;
    }
  }

  if (!companyId) {
    console.error(
      "syncSubscription: could not resolve company for subscription",
      sub.id,
      "customer",
      customerId,
    );
    return { companyId: null, prevStatus, newStatus: status, plan, customerId };
  }

  const { error } = await admin.from("subscriptions").upsert(
    {
      company_id: companyId,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      plan,
      status,
      current_period_end: toIso(item?.current_period_end),
      trial_end: toIso(sub.trial_end),
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" },
  );

  if (error) {
    console.error("syncSubscription: upsert failed", error);
  }

  return { companyId, prevStatus, newStatus: status, plan, customerId };
}

export async function getCompanyIdByCustomer(
  customerId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("company_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ company_id: string }>();
  return data?.company_id ?? null;
}

/**
 * Pulls the latest subscription state straight from Stripe for one company and
 * syncs it. Used on the checkout success redirect so billing works even before
 * the webhook is registered (and as a safety net if a webhook is delayed).
 */
export async function reconcileCompanyFromStripe(
  companyId: string,
): Promise<SyncResult | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("company_id", companyId)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  if (!row?.stripe_customer_id) return null;

  const subs = await stripe.subscriptions.list({
    customer: row.stripe_customer_id,
    status: "all",
    limit: 1,
  });
  const sub = subs.data[0];
  if (!sub) return null;

  return syncSubscription(sub);
}

/** Marks a company's subscription canceled (subscription.deleted webhook). */
export async function markSubscriptionCanceled(
  stripeSubscriptionId: string,
): Promise<{ companyId: string | null }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .select("company_id")
    .maybeSingle<{ company_id: string }>();

  return { companyId: data?.company_id ?? null };
}
