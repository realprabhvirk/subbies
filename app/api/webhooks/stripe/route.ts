import type { NextRequest } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/billing/stripe";
import {
  syncSubscription,
  markSubscriptionCanceled,
  getCompanyIdByCustomer,
  type SyncResult,
} from "@/lib/billing/sync";
import { getCompanyOwnerEmail } from "@/lib/onboarding";
import { getAppUrl } from "@/lib/app-url";
import { PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import {
  sendTrialStartedEmail,
  sendSubscriptionStartedEmail,
  sendTrialEndingEmail,
  sendPaymentFailedEmail,
} from "@/lib/email/billing";
import { markTrialReminderSent } from "@/lib/billing/trial-reminders";

export const runtime = "nodejs";

const RELEVANT = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.trial_will_end",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

/**
 * Sends the one-off "you're set up" email on the first transition into a live
 * subscription. With a trial attached, that first status is `trialing`, not
 * `active` — the previous version only fired on `active`, so with trials
 * enabled the welcome email would never have been sent. The trial→active
 * conversion then sends the "card charged" email.
 */
async function sendActivationEmail(result: SyncResult): Promise<void> {
  if (!result.companyId || !result.plan) return;

  const plan = PLANS[result.plan];
  const wasLive =
    result.prevStatus === "trialing" ||
    result.prevStatus === "active" ||
    result.prevStatus === "past_due";

  const isTrialStart = result.newStatus === "trialing" && !wasLive;
  const isCharged =
    result.newStatus === "active" && result.prevStatus !== "active";

  if (!isTrialStart && !isCharged) return;

  const email = await getCompanyOwnerEmail(result.companyId);
  if (!email) return;

  if (isTrialStart) {
    await sendTrialStartedEmail({
      to: email,
      planName: plan.name,
      amount: plan.amount,
      trialDays: TRIAL_DAYS,
      trialEnd: result.trialEnd,
    });
    return;
  }

  await sendSubscriptionStartedEmail({
    to: email,
    planName: plan.name,
    amount: plan.amount,
  });
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    console.error("stripe webhook hit but STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not set");
    return new Response("Billing not configured", { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch (err) {
    console.error("stripe webhook signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (!RELEVANT.has(event.type)) {
    return new Response("ignored", { status: 200 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          const result = await syncSubscription(sub);
          await sendActivationEmail(result);
        }
        break;
      }

      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const result = await syncSubscription(sub);
        // checkout.session.completed usually gets here first; both paths are
        // guarded by prevStatus so the email is sent at most once.
        await sendActivationEmail(result);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const result = await syncSubscription(sub);
        await sendActivationEmail(result);
        break;
      }

      // Stripe fires this three days before a trial ends. On a 7-day trial
      // that lands on day 4-5, which is the day-5 reminder. The daily cron is
      // the backstop; both write the same idempotency stamp so only one sends.
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const result = await syncSubscription(sub);
        if (result.companyId && result.plan && result.newStatus === "trialing") {
          const claimed = await markTrialReminderSent(result.companyId, "day5");
          if (claimed) {
            const email = await getCompanyOwnerEmail(result.companyId);
            if (email) {
              const appUrl = await getAppUrl();
              const daysLeft = result.trialEnd
                ? Math.max(
                    1,
                    Math.ceil(
                      (new Date(result.trialEnd).getTime() - Date.now()) /
                        86_400_000,
                    ),
                  )
                : 2;
              await sendTrialEndingEmail({
                to: email,
                planName: PLANS[result.plan].name,
                amount: PLANS[result.plan].amount,
                daysLeft,
                trialEnd: result.trialEnd,
                billingUrl: `${appUrl}/dashboard/settings?tab=billing`,
              });
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await markSubscriptionCanceled(sub.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : (invoice.customer?.id ?? null);
        if (customerId) {
          const companyId = await getCompanyIdByCustomer(customerId);
          if (companyId) {
            const email = await getCompanyOwnerEmail(companyId);
            if (email) {
              const appUrl = await getAppUrl();
              await sendPaymentFailedEmail({
                to: email,
                billingUrl: `${appUrl}/dashboard/settings?tab=billing`,
              });
            }
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("stripe webhook handler error", event.type, err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
