import type { NextRequest } from "next/server";

import { getStripe } from "@/lib/billing/stripe";
import { PLANS, PLAN_IDS, priceIdForPlan } from "@/lib/billing/plans";
import { priceUnusableReason } from "@/lib/billing/errors";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Billing configuration self-check.
 *
 * Answers, against the *deployed* environment rather than a local .env:
 *   - which billing env vars are actually present here
 *   - whether each STRIPE_PRICE_* resolves to a real, active, recurring price
 *     in the account the secret key belongs to
 *   - whether that price's amount and currency match what the app advertises
 *   - whether the keys are test-mode or live-mode, and whether they agree
 *   - whether the subscriptions table has the columns the app writes to
 *
 * Protected with CRON_SECRET (same header shape as the Vercel cron):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/health/billing
 *
 * Never returns a secret — only whether one is set, and its mode.
 */

function describeKey(value: string | undefined): string {
  if (!value?.trim()) return "missing";
  const v = value.trim();
  if (v !== value) return "set (has leading/trailing whitespace — likely broken)";
  if (v.startsWith("sk_live_") || v.startsWith("rk_live_")) return "set (live mode)";
  if (v.startsWith("sk_test_") || v.startsWith("rk_test_")) return "set (test mode)";
  if (v.startsWith("pk_live_")) return "set (live mode)";
  if (v.startsWith("pk_test_")) return "set (test mode)";
  return "set";
}

function describePresence(value: string | undefined): string {
  if (value === undefined) return "missing";
  if (!value.trim()) return "set but blank";
  if (value.trim() !== value) return "set (has leading/trailing whitespace — likely broken)";
  return "set";
}

interface PriceReport {
  plan: string;
  envVar: string;
  configured: string | null;
  ok: boolean;
  problem: string | null;
  active?: boolean;
  livemode?: boolean;
  currency?: string;
  unitAmount?: number | null;
  interval?: string | null;
  appAdvertises: string;
  amountMatchesApp?: boolean;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const env = {
    STRIPE_SECRET_KEY: describeKey(process.env.STRIPE_SECRET_KEY),
    STRIPE_WEBHOOK_SECRET: describePresence(process.env.STRIPE_WEBHOOK_SECRET),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: describeKey(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    ),
    STRIPE_PRICE_STARTER: describePresence(process.env.STRIPE_PRICE_STARTER),
    STRIPE_PRICE_BUSINESS: describePresence(process.env.STRIPE_PRICE_BUSINESS),
    STRIPE_PRICE_PRO: describePresence(process.env.STRIPE_PRICE_PRO),
    NEXT_PUBLIC_SUPABASE_URL: describePresence(process.env.NEXT_PUBLIC_SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: describePresence(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
    SUPABASE_SERVICE_ROLE_KEY: describePresence(process.env.SUPABASE_SERVICE_ROLE_KEY),
    NEXT_PUBLIC_APP_URL: describePresence(process.env.NEXT_PUBLIC_APP_URL),
    RESEND_API_KEY: describePresence(process.env.RESEND_API_KEY),
    CRON_SECRET: describePresence(process.env.CRON_SECRET),
  };

  const notes: string[] = [];
  notes.push(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not read anywhere in this app — checkout is a server-side redirect to Stripe-hosted Checkout, so it being missing cannot break checkout.",
  );

  const stripe = getStripe();
  const prices: PriceReport[] = [];

  if (!stripe) {
    notes.push("STRIPE_SECRET_KEY is not set, so no price could be verified.");
  } else {
    for (const plan of PLAN_IDS) {
      const config = PLANS[plan];
      const configured = priceIdForPlan(plan);
      const base: PriceReport = {
        plan,
        envVar: config.priceIdEnv,
        configured,
        ok: false,
        problem: null,
        appAdvertises: `A$${config.amount}/month`,
      };

      if (!configured) {
        prices.push({ ...base, problem: `${config.priceIdEnv} is not set` });
        continue;
      }

      try {
        const price = await stripe.prices.retrieve(configured);
        const unusable = priceUnusableReason(price);
        const expectedCents = config.amount * 100;
        const amountMatchesApp = price.unit_amount === expectedCents;

        const problems: string[] = [];
        if (unusable) problems.push(`this price is ${unusable}`);
        if (!amountMatchesApp) {
          problems.push(
            `Stripe charges ${price.unit_amount === null ? "an unspecified amount" : `${price.unit_amount / 100} ${price.currency.toUpperCase()}`} but the app advertises A$${config.amount}`,
          );
        }
        if (price.currency !== "aud") {
          problems.push(`currency is ${price.currency.toUpperCase()}, not AUD`);
        }

        prices.push({
          ...base,
          ok: problems.length === 0,
          problem: problems.length ? problems.join("; ") : null,
          active: price.active,
          livemode: price.livemode,
          currency: price.currency,
          unitAmount: price.unit_amount,
          interval: price.recurring?.interval ?? null,
          amountMatchesApp,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        prices.push({
          ...base,
          problem: `Stripe could not retrieve this price: ${message}`,
        });
      }
    }

    const modes = new Set(
      prices.filter((p) => p.livemode !== undefined).map((p) => p.livemode),
    );
    if (modes.size > 1) {
      notes.push(
        "The configured prices are a mix of test-mode and live-mode. Every price must be in the same mode as STRIPE_SECRET_KEY.",
      );
    }
  }

  // The app writes these columns; a migration that never ran shows up here.
  const schema: Record<string, string> = {};
  try {
    const admin = createAdminClient();
    const columns = [
      "status",
      "plan",
      "stripe_customer_id",
      "stripe_subscription_id",
      "trial_end",
      "onboarding_completed_at",
      "trial_reminder_day5_at",
      "trial_reminder_day7_at",
    ];
    for (const column of columns) {
      const { error } = await admin
        .from("subscriptions")
        .select(column)
        .limit(1);
      schema[column] = error ? `MISSING (${error.message})` : "present";
    }
  } catch (err) {
    schema._error = err instanceof Error ? err.message : String(err);
  }

  const healthy =
    env.STRIPE_SECRET_KEY.startsWith("set") &&
    prices.length > 0 &&
    prices.every((p) => p.ok) &&
    Object.values(schema).every((v) => v === "present");

  return Response.json({ healthy, env, prices, schema, notes }, { status: 200 });
}
