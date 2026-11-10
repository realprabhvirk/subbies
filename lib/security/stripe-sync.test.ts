/**
 * M5: subscription webhooks sync from Stripe's current state, so events that
 * arrive out of order can't switch a cancelled company back on. Runs the real
 * webhook handler and the real sync against a fake Stripe and the in-memory
 * Supabase fake. The fake Stripe's constructEventAsync just parses the body:
 * signature checking is Stripe's own library and isn't what's tested here.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { installServerModuleStubs } from "../test-support/server-module-stubs.ts";
import { resetFake, fakeModuleSource } from "../test-support/fake-supabase.ts";

process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_placeholder";
process.env.STRIPE_PRICE_STARTER = "price_starter_test";
process.env.STRIPE_PRICE_BUSINESS = "price_business_test";
process.env.STRIPE_PRICE_PRO = "price_pro_test";

type FakeSub = { default_payment_method?: string | null; id: string; customer: string; status: string; trial_end: number | null; cancel_at_period_end: boolean; metadata: Record<string, string>; items: { data: { price: { id: string }; current_period_end: number }[] } };
const stripeState = {
  subs: new Map<string, FakeSub>(),
  retrieved: [] as string[],
  emails: [] as string[],
  updates: [] as { id: string; params: Record<string, unknown> }[],
  fingerprints: {} as Record<string, string>,
  customerPm: null as string | null,
  pmFails: false,
};
(globalThis as Record<string, unknown>).__stripeState = stripeState;

installServerModuleStubs({
  "server-only": ``,
  "@/lib/supabase/admin": fakeModuleSource(`export function createAdminClient(){ return F.makeClient(); }`),
  "@/lib/billing/stripe": `
    const st = () => globalThis.__stripeState;
    const stripe = {
      webhooks: { constructEventAsync: async (payload) => JSON.parse(payload) },
      subscriptions: {
        retrieve: async (id) => {
          st().retrieved.push(id);
          const sub = st().subs.get(id);
          if (!sub) { const e = new Error("No such subscription"); e.code = "resource_missing"; throw e; }
          return structuredClone(sub);
        },
        list: async () => ({ data: [] }),
        cancel: async () => ({}),
        update: async (id, params) => {
          const sub = st().subs.get(id);
          st().updates.push({ id, params });
          if (params.trial_end === "now") { sub.status = "active"; sub.trial_end = null; }
          return structuredClone(sub);
        },
      },
      customers: { retrieve: async (id) => ({ id, invoice_settings: { default_payment_method: st().customerPm ?? null } }) },
      paymentMethods: {
        retrieve: async (id) => {
          if (st().pmFails) { const e = new Error("pm lookup failed"); e.code = "api_error"; throw e; }
          return { id, card: { fingerprint: st().fingerprints[id] } };
        },
      },
    };
    export function getStripe(){ return stripe; }
  `,
  "@/lib/onboarding": `export async function getCompanyOwnerEmail(){ return "owner@acme.test"; }`,
  "@/lib/app-url": `export async function getAppUrl(){ return "https://app.test"; }`,
  "@/lib/billing/trial-reminders": `export async function markTrialReminderSent(){ return true; }`,
  "@/lib/email/billing": `
    const rec = (kind) => async (input) => { globalThis.__stripeState.emails.push(kind + (input?.trialNotApplied ? ":no_trial" : "")); return { ok: true }; };
    export const sendTrialStartedEmail = rec("trial_started");
    export const sendSubscriptionStartedEmail = rec("subscription_started");
    export const sendTrialEndingEmail = rec("trial_ending");
    export const sendPaymentFailedEmail = rec("payment_failed");
    export const sendTrialNotAppliedEmail = rec("trial_not_applied");
  `,
});

const { POST } = await import("../../app/api/webhooks/stripe/route.ts");

const A = "2f7fc5a6-badc-46a4-8b27-afd25746ea8c";

function sub(id: string, status: string): FakeSub {
  return {
    id, customer: "cus_A", status, trial_end: null, cancel_at_period_end: false, metadata: { company_id: A },
    items: { data: [{ price: { id: "price_starter_test" }, current_period_end: 2_000_000_000 }] },
  };
}

function seed(dbStatus: string) {
  const s = resetFake();
  s.tables.subscriptions = [{ company_id: A, stripe_customer_id: "cus_A", stripe_subscription_id: "sub_1", status: dbStatus, plan: "starter", onboarding_completed_at: "2026-01-01" }];
  stripeState.subs.clear();
  stripeState.retrieved.length = 0;
  stripeState.emails.length = 0;
  stripeState.updates.length = 0;
  stripeState.fingerprints = {};
  stripeState.customerPm = null;
  stripeState.pmFails = false;
  return s;
}

async function deliver(type: string, object: unknown) {
  const body = JSON.stringify({ id: `evt_${Math.random()}`, type, data: { object } });
  const res = await POST(new Request("https://app.test/api/webhooks/stripe", {
    method: "POST", body, headers: { "stripe-signature": "t=1,v1=fake" },
  }) as never);
  return res.status;
}

test("M5: a stale 'active' update arriving after 'deleted' leaves the company inactive", async () => {
  const s = seed("active");
  stripeState.subs.set("sub_1", sub("sub_1", "canceled")); // Stripe's truth now

  assert.equal(await deliver("customer.subscription.deleted", sub("sub_1", "canceled")), 200);
  assert.equal(s.tables.subscriptions[0].status, "canceled");

  // The old event, still carrying "active" in its body, turns up late.
  assert.equal(await deliver("customer.subscription.updated", sub("sub_1", "active")), 200);
  assert.equal(s.tables.subscriptions[0].status, "canceled", "the stale body was not trusted");
  assert.ok(stripeState.retrieved.length >= 2, "each event re-read Stripe");
  assert.deepEqual(stripeState.emails, [], "no welcome email for a dead subscription");
});

test("M5: a subscription Stripe no longer has is marked cancelled", async () => {
  const s = seed("active");
  assert.equal(await deliver("customer.subscription.updated", sub("sub_1", "active")), 200);
  assert.equal(s.tables.subscriptions[0].status, "canceled");
});

test("M5: an old subscription's late event can't overwrite the company's newer one", async () => {
  const s = seed("active");
  s.tables.subscriptions[0].stripe_subscription_id = "sub_2";
  stripeState.subs.set("sub_1", sub("sub_1", "canceled"));
  stripeState.subs.set("sub_2", sub("sub_2", "active"));
  const err = console.error;
  console.error = () => {};
  try {
    assert.equal(await deliver("customer.subscription.deleted", sub("sub_1", "canceled")), 200);
  } finally {
    console.error = err;
  }
  assert.equal(s.tables.subscriptions[0].status, "active");
  assert.equal(s.tables.subscriptions[0].stripe_subscription_id, "sub_2");
});

test("M5 normal path: a new trial is synced from Stripe and the welcome email goes once", async () => {
  const s = seed("none");
  s.tables.subscriptions[0].stripe_subscription_id = null;
  s.tables.subscriptions[0].onboarding_completed_at = null;
  stripeState.subs.set("sub_1", { ...sub("sub_1", "trialing"), trial_end: 2_000_000_000 });
  assert.equal(await deliver("customer.subscription.created", sub("sub_1", "incomplete")), 200);
  assert.equal(s.tables.subscriptions[0].status, "trialing");
  assert.equal(s.tables.subscriptions[0].plan, "starter");
  assert.deepEqual(stripeState.emails, ["trial_started"]);

  assert.equal(await deliver("customer.subscription.updated", sub("sub_1", "trialing")), 200);
  assert.deepEqual(stripeState.emails, ["trial_started"], "not sent twice");
});

test("M5: a Stripe outage answers 500 so Stripe retries", async () => {
  seed("active");
  const st = stripeState as unknown as { subs: { get: () => never } };
  const original = stripeState.subs.get.bind(stripeState.subs);
  st.subs.get = () => { throw Object.assign(new Error("api down"), { code: "api_error" }); };
  const err = console.error;
  console.error = () => {};
  try {
    assert.equal(await deliver("customer.subscription.updated", sub("sub_1", "active")), 500);
  } finally {
    console.error = err;
    (stripeState.subs as unknown as { get: typeof original }).get = original;
  }
});

// ---------------------------------------------------------------------------
// M6: one free trial per card

const B = "34c4652e-ae33-4973-82e5-53d8b1ed7a20";

function checkoutSession(subId: string, companyId: string) {
  return { id: "cs_1", mode: "subscription", subscription: subId, client_reference_id: companyId };
}

function seedTrialCheckout(companyId: string, fingerprint: string) {
  const s = seed("none");
  s.tables.subscriptions = [{ company_id: companyId, stripe_customer_id: "cus_A", stripe_subscription_id: null, status: "none", plan: null, onboarding_completed_at: null }];
  const trialing = { ...sub("sub_1", "trialing"), metadata: { company_id: companyId }, trial_end: 2_000_000_000, default_payment_method: "pm_1" };
  stripeState.subs.set("sub_1", trialing);
  stripeState.fingerprints = { pm_1: fingerprint };
  return s;
}

const quiet = async <T>(fn: () => Promise<T>) => {
  const e = console.error, w = console.warn;
  console.error = () => {}; console.warn = () => {};
  try { return await fn(); } finally { console.error = e; console.warn = w; }
};

test("M6 normal path: a new card keeps its trial and is recorded", async () => {
  const s = seedTrialCheckout(A, "fp_new");
  assert.equal(await deliver("checkout.session.completed", checkoutSession("sub_1", A)), 200);
  assert.equal(s.tables.subscriptions[0].status, "trialing");
  assert.deepEqual(stripeState.updates, []);
  assert.deepEqual(stripeState.emails, ["trial_started"]);
  assert.equal(s.tables.trial_card_fingerprints.length, 1);
});

test("M6: a card that already had a trial on another company has the trial ended, and the email says so", async () => {
  const s = seedTrialCheckout(B, "fp_used");
  s.tables.trial_card_fingerprints = [{ fingerprint: "fp_used", first_company_id: A }];
  assert.equal(await quiet(() => deliver("checkout.session.completed", checkoutSession("sub_1", B))), 200);
  assert.deepEqual(stripeState.updates.map((u) => u.params.trial_end), ["now"]);
  assert.equal(s.tables.subscriptions[0].status, "active");
  assert.deepEqual(stripeState.emails, ["subscription_started:no_trial"]);
});

test("M6: the same company's webhook retry keeps its trial", async () => {
  const s = seedTrialCheckout(A, "fp_mine");
  s.tables.trial_card_fingerprints = [{ fingerprint: "fp_mine", first_company_id: A }];
  assert.equal(await deliver("checkout.session.completed", checkoutSession("sub_1", A)), 200);
  assert.deepEqual(stripeState.updates, []);
  assert.equal(s.tables.subscriptions[0].status, "trialing");
});

test("M6: a card lookup error fails open, leaving the trial", async () => {
  const s = seedTrialCheckout(B, "fp_used");
  s.tables.trial_card_fingerprints = [{ fingerprint: "fp_used", first_company_id: A }];
  stripeState.pmFails = true;
  assert.equal(await quiet(() => deliver("checkout.session.completed", checkoutSession("sub_1", B))), 200);
  assert.deepEqual(stripeState.updates, []);
  assert.equal(s.tables.subscriptions[0].status, "trialing");
});

test("M6: a ledger error fails open, leaving the trial", async () => {
  const s = seedTrialCheckout(B, "fp_used");
  s.rpcErrors.claim_trial_fingerprint = "db down";
  assert.equal(await quiet(() => deliver("checkout.session.completed", checkoutSession("sub_1", B))), 200);
  assert.deepEqual(stripeState.updates, []);
});

test("M6: the card falls back to the customer's default payment method", async () => {
  const s = seedTrialCheckout(B, "fp_used");
  s.tables.trial_card_fingerprints = [{ fingerprint: "fp_used", first_company_id: A }];
  stripeState.subs.get("sub_1")!.default_payment_method = null;
  stripeState.customerPm = "pm_1";
  await quiet(() => deliver("checkout.session.completed", checkoutSession("sub_1", B)));
  assert.equal(stripeState.updates.length, 1);
});
