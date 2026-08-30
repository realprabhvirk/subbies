import type { NextRequest } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/billing/stripe";
import {
  syncSubscription,
  markSubscriptionCanceled,
  getCompanyIdByCustomer,
} from "@/lib/billing/sync";
import { getCompanyOwnerEmail } from "@/lib/onboarding";
import { getAppUrl } from "@/lib/app-url";
import { PLANS } from "@/lib/billing/plans";
import {
  sendTrialEndingEmail,
  sendTrialConvertedEmail,
  sendPaymentFailedEmail,
} from "@/lib/email/billing";

export const runtime = "nodejs";

const RELEVANT = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.payment_failed",
]);

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
          await syncSubscription(sub);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const result = await syncSubscription(sub);

        if (
          result.companyId &&
          result.plan &&
          result.prevStatus === "trialing" &&
          result.newStatus === "active"
        ) {
          const email = await getCompanyOwnerEmail(result.companyId);
          if (email) {
            await sendTrialConvertedEmail({
              to: email,
              planName: PLANS[result.plan].name,
              amount: PLANS[result.plan].amount,
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await markSubscriptionCanceled(sub.id);
        break;
      }

      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const result = await syncSubscription(sub);
        if (result.companyId && result.plan) {
          const email = await getCompanyOwnerEmail(result.companyId);
          if (email) {
            await sendTrialEndingEmail({
              to: email,
              planName: PLANS[result.plan].name,
              amount: PLANS[result.plan].amount,
              trialEnd: sub.trial_end
                ? new Date(sub.trial_end * 1000).toISOString()
                : null,
            });
          }
        }
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
    // 500 → Stripe retries with backoff.
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
