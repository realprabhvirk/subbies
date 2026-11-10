import "server-only";

import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The fingerprint of the card behind a subscription: Stripe's stable id for
 * a physical card, the same across customers and accounts. null when there's
 * no card (or the payment method isn't a card).
 */
async function cardFingerprint(stripe: Stripe, sub: Stripe.Subscription): Promise<string | null> {
  let pm: string | Stripe.PaymentMethod | null = sub.default_payment_method ?? null;
  if (!pm) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const customer = await stripe.customers.retrieve(customerId);
    if (!("deleted" in customer && customer.deleted)) {
      pm = (customer as Stripe.Customer).invoice_settings?.default_payment_method ?? null;
    }
  }
  if (!pm) return null;
  const method = typeof pm === "string" ? await stripe.paymentMethods.retrieve(pm) : pm;
  return method.card?.fingerprint ?? null;
}

export type TrialCardOutcome =
  | { removed: false }
  | { removed: true; subscription: Stripe.Subscription };

/**
 * One free trial per card (M6). Run on checkout.session.completed for a
 * trialing subscription: if this card has already had a trial on another
 * company, the trial is ended now (so the plan charges straight away).
 *
 * Fails OPEN on every error (logged): a lookup problem must never cost a
 * genuine new customer their trial. No IP-based checks. The fingerprint is
 * never logged.
 */
export async function enforceOneTrialPerCard(
  stripe: Stripe,
  sub: Stripe.Subscription,
  companyId: string,
): Promise<TrialCardOutcome> {
  let fingerprint: string | null;
  try {
    fingerprint = await cardFingerprint(stripe, sub);
  } catch (err) {
    console.error("enforceOneTrialPerCard: card lookup failed, trial left in place", {
      companyId,
      code: (err as { code?: string }).code,
    });
    return { removed: false };
  }
  if (!fingerprint) {
    console.error("enforceOneTrialPerCard: no card fingerprint, trial left in place", { companyId });
    return { removed: false };
  }

  const { data: allowed, error } = await createAdminClient().rpc("claim_trial_fingerprint", {
    p_fingerprint: fingerprint,
    p_company_id: companyId,
  });
  if (error) {
    console.error("enforceOneTrialPerCard: ledger check failed, trial left in place", {
      companyId,
      code: error.code,
    });
    return { removed: false };
  }
  if (allowed === true) return { removed: false };

  try {
    const updated = await stripe.subscriptions.update(sub.id, {
      trial_end: "now",
      proration_behavior: "none",
    });
    console.warn("enforceOneTrialPerCard: card already had a trial, trial ended", { companyId });
    return { removed: true, subscription: updated };
  } catch (err) {
    console.error("enforceOneTrialPerCard: couldn't end the trial, left in place", {
      companyId,
      code: (err as { code?: string }).code,
    });
    return { removed: false };
  }
}
