"use server";

import { revalidatePath } from "next/cache";

import { getCompany, getUser } from "@/lib/supabase/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";
import { getStripe } from "@/lib/billing/stripe";
import { getEntitlement } from "@/lib/billing/entitlements";
import { priceIdForPlan, PLANS, PLAN_IDS, type PlanId } from "@/lib/billing/plans";
import { describeBillingError } from "@/lib/billing/errors";

type Result = { ok: boolean; url?: string; error?: string };

async function resolveCustomerId(
  companyId: string,
  fallbackEmail: string | null,
  companyName: string,
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("company_id", companyId)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: fallbackEmail ?? undefined,
    name: companyName,
    metadata: { company_id: companyId },
  });

  const { error } = await admin.from("subscriptions").upsert(
    {
      company_id: companyId,
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" },
  );

  // Not fatal to this checkout, but it means we'd mint a fresh Stripe customer
  // on every attempt and lose track of the one that actually pays — so it has
  // to be loud rather than swallowed.
  if (error) {
    console.error("resolveCustomerId: failed to persist stripe_customer_id", {
      companyId,
      customerId: customer.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }

  return customer.id;
}

export async function startCheckout(planId: PlanId): Promise<Result> {
  if (!PLAN_IDS.includes(planId)) return { ok: false, error: "Unknown plan." };

  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };
  const user = await getUser();

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Billing isn't configured yet." };

  const entitlement = await getEntitlement(company.id);
  if (entitlement.paidAccess && entitlement.status !== "past_due") {
    return {
      ok: false,
      error: "You already have an active plan. Use “Manage billing” to change it.",
    };
  }

  // Resolved before anything is created in Stripe so a misconfigured Price ID
  // fails with a message that names the env var instead of a generic retry.
  const priceId = priceIdForPlan(planId);
  if (!priceId) {
    console.error(
      `startCheckout: ${PLANS[planId].priceIdEnv} is not set in this environment`,
    );
    return {
      ok: false,
      error: `Billing isn't fully configured: ${PLANS[planId].priceIdEnv} is missing from this deployment's environment settings.`,
    };
  }

  try {
    const customerId = await resolveCustomerId(
      company.id,
      user?.email ?? null,
      company.name,
    );
    const appUrl = await getAppUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: company.id,
      line_items: [{ price: priceId, quantity: 1 }],
      // No trial — the 7-day free tier serves that purpose. Checkout charges
      // today (or applies a promo code the customer enters).
      subscription_data: {
        metadata: { company_id: company.id },
      },
      payment_method_collection: "always",
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${appUrl}/billing/return`,
      cancel_url: `${appUrl}/billing/return?state=cancelled`,
    });

    if (!session.url) {
      console.error("startCheckout: Stripe returned a session with no URL", session.id);
      return { ok: false, error: "Couldn't start checkout. Try again." };
    }
    return { ok: true, url: session.url };
  } catch (err) {
    const failure = describeBillingError(err, "Couldn't start checkout. Try again.");
    console.error("startCheckout failed", { plan: planId, ...failure.log });
    return { ok: false, error: failure.message };
  }
}

export async function openBillingPortal(): Promise<Result> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Billing isn't configured yet." };

  const entitlement = await getEntitlement(company.id);
  if (!entitlement.stripeCustomerId) {
    return { ok: false, error: "No billing account yet — start a plan first." };
  }

  try {
    const appUrl = await getAppUrl();
    const session = await stripe.billingPortal.sessions.create({
      customer: entitlement.stripeCustomerId,
      return_url: `${appUrl}/dashboard/settings?tab=billing`,
    });
    return { ok: true, url: session.url };
  } catch (err) {
    const failure = describeBillingError(
      err,
      "Couldn't open the billing portal. If this persists, the Stripe customer portal may need to be enabled in your Stripe dashboard.",
    );
    console.error("openBillingPortal failed", failure.log);
    return { ok: false, error: failure.message };
  }
}

export async function cancelSubscription(): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Billing isn't configured yet." };

  const entitlement = await getEntitlement(company.id);
  if (!entitlement.stripeSubscriptionId) {
    return { ok: false, error: "No active subscription to cancel." };
  }

  try {
    await stripe.subscriptions.update(entitlement.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    const admin = createAdminClient();
    await admin
      .from("subscriptions")
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
      .eq("company_id", company.id);

    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (err) {
    const failure = describeBillingError(err, "Couldn't cancel. Try again.");
    console.error("cancelSubscription failed", failure.log);
    return { ok: false, error: failure.message };
  }
}

export async function resumeSubscription(): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Billing isn't configured yet." };

  const entitlement = await getEntitlement(company.id);
  if (!entitlement.stripeSubscriptionId) {
    return { ok: false, error: "No subscription to resume." };
  }

  try {
    await stripe.subscriptions.update(entitlement.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });
    const admin = createAdminClient();
    await admin
      .from("subscriptions")
      .update({ cancel_at_period_end: false, updated_at: new Date().toISOString() })
      .eq("company_id", company.id);

    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (err) {
    const failure = describeBillingError(err, "Couldn't resume. Try again.");
    console.error("resumeSubscription failed", failure.log);
    return { ok: false, error: failure.message };
  }
}
