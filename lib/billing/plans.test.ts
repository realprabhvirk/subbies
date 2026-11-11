import test from "node:test";
import assert from "node:assert/strict";

import {
  PLANS,
  PLAN_CONFIG,
  PLAN_IDS,
  FEATURE_MIN_PLAN,
  can,
  checkLimit,
  featureError,
  limitFor,
  limitLine,
  planToAdd,
  type PlanFeature,
} from "./plans.ts";

test("PLANS is PLAN_CONFIG (old imports keep working)", () => {
  assert.equal(PLANS, PLAN_CONFIG);
  assert.deepEqual([...PLAN_IDS], ["starter", "business", "pro"]);
});

test("prices are unchanged", () => {
  assert.deepEqual(PLAN_IDS.map((id) => PLANS[id].amount), [19, 39, 79]);
  assert.deepEqual(PLAN_IDS.map((id) => PLANS[id].priceIdEnv), [
    "STRIPE_PRICE_STARTER",
    "STRIPE_PRICE_BUSINESS",
    "STRIPE_PRICE_PRO",
  ]);
});

test("Starter: 5 contractors, 7 document types, 1 project", () => {
  assert.equal(limitFor("starter", "contractors"), 5);
  assert.equal(limitFor("starter", "documentTypes"), 7);
  assert.equal(limitFor("starter", "projects"), 1);
});

test("Business: 25 contractors, 15 document types, 10 projects", () => {
  assert.equal(limitFor("business", "contractors"), 25);
  assert.equal(limitFor("business", "documentTypes"), 15);
  assert.equal(limitFor("business", "projects"), 10);
});

test("Pro: unlimited contractors, document types and projects; 10 seats", () => {
  assert.equal(limitFor("pro", "contractors"), null);
  assert.equal(limitFor("pro", "documentTypes"), null);
  assert.equal(limitFor("pro", "projects"), null);
  assert.equal(limitFor("pro", "seats"), 10);
});

test("photos are capped at 3 on every plan; seats are 1 below Pro", () => {
  for (const id of PLAN_IDS) assert.equal(limitFor(id, "photos"), 3, id);
  assert.equal(limitFor("starter", "seats"), 1);
  assert.equal(limitFor("business", "seats"), 1);
});

test("no plan or an unknown plan gets nothing", () => {
  assert.equal(limitFor(null, "contractors"), 0);
  assert.equal(limitFor(undefined, "projects"), 0);
  assert.equal(limitFor("enterprise" as never, "contractors"), 0);
  assert.equal(can(null, "map"), false);
  assert.equal(can("enterprise" as never, "map"), false);
});

test("feature flags: all plans, Business and up, Pro only", () => {
  const allPlans: PlanFeature[] = ["projectCompliance", "map", "photos"];
  const businessUp: PlanFeature[] = ["requirements", "documentRegister", "activityView", "pdfExport"];
  const proOnly: PlanFeature[] = ["analytics", "team", "bulkTools", "auditExports", "prioritySupport"];
  for (const f of allPlans) {
    assert.deepEqual(PLAN_IDS.map((p) => can(p, f)), [true, true, true], f);
  }
  for (const f of businessUp) {
    assert.deepEqual(PLAN_IDS.map((p) => can(p, f)), [false, true, true], f);
  }
  for (const f of proOnly) {
    assert.deepEqual(PLAN_IDS.map((p) => can(p, f)), [false, false, true], f);
  }
  // Every feature is classified exactly once.
  assert.equal(Object.keys(FEATURE_MIN_PLAN).length, allPlans.length + businessUp.length + proOnly.length);
});

test("featureError names the feature and the plan that unlocks it", () => {
  assert.equal(featureError("pro", "analytics"), null);
  assert.deepEqual(featureError("starter", "pdfExport"), {
    code: "PLAN_FEATURE",
    feature: "pdfExport",
    requiredPlan: "business",
    currentPlan: "starter",
  });
  assert.deepEqual(featureError("business", "team"), {
    code: "PLAN_FEATURE",
    feature: "team",
    requiredPlan: "pro",
    currentPlan: "business",
  });
});

test("feature lists render limits from the config, never a separate literal", () => {
  for (const id of PLAN_IDS) {
    const l = PLANS[id].limits;
    assert.deepEqual(PLANS[id].features.slice(0, 3), [
      limitLine(l.contractors, "contractors"),
      limitLine(l.documentTypes, "documentTypes"),
      limitLine(l.projects, "projects"),
    ]);
  }
  assert.equal(PLANS.starter.features[2], "1 project");
  assert.equal(PLANS.pro.features[0], "Unlimited contractors");
});

test("marketing copy makes no storage claims", () => {
  for (const id of PLAN_IDS) {
    const all = [...PLANS[id].features, ...PLANS[id].comingSoon, PLANS[id].blurb].join(" ");
    assert.doesNotMatch(all, /storage|GB|MB\b/i, id);
  }
});

const base = { plan: "starter" as const, status: "active" as const, resource: "contractors" as const };

test("checkLimit: under the limit is allowed", () => {
  const r = checkLimit({ ...base, used: 4 });
  assert.equal(r.allowed, true);
  assert.equal(r.limit, 5);
  assert.equal(r.planError, null);
});

test("checkLimit: at the limit returns a typed PLAN_LIMIT error naming the next plan", () => {
  const r = checkLimit({ ...base, used: 5 });
  assert.equal(r.allowed, false);
  assert.equal(r.accessLapsed, false);
  assert.deepEqual(r.planError, {
    code: "PLAN_LIMIT",
    resource: "contractors",
    requiredPlan: "business",
    currentPlan: "starter",
    limit: 5,
    used: 5,
  });
});

test("checkLimit: Business at its project limit points at Pro", () => {
  const r = checkLimit({ plan: "business", status: "active", resource: "projects", used: 10 });
  assert.equal(r.allowed, false);
  assert.equal(r.planError?.requiredPlan, "pro");
});

test("checkLimit: Pro is never limited", () => {
  const r = checkLimit({ plan: "pro", status: "active", resource: "contractors", used: 10_000 });
  assert.equal(r.allowed, true);
  assert.equal(r.limit, null);
});

test("checkLimit: trial has the plan's own limits from day one", () => {
  assert.equal(checkLimit({ ...base, status: "trialing", used: 4 }).allowed, true);
  assert.equal(checkLimit({ ...base, status: "trialing", used: 5 }).allowed, false);
});

test("checkLimit: past_due keeps access and limits while Stripe retries", () => {
  const r = checkLimit({ ...base, status: "past_due", used: 2 });
  assert.equal(r.allowed, true);
  assert.equal(r.accessLapsed, false);
});

test("checkLimit: lapsed access blocks everything, and it isn't a plan error", () => {
  for (const status of ["canceled", "unpaid", "none", "incomplete"] as const) {
    const r = checkLimit({ plan: "pro", status: status as never, resource: "contractors", used: 0 });
    assert.equal(r.allowed, false, status);
    assert.equal(r.accessLapsed, true, status);
    assert.equal(r.planError, null, status);
  }
});

test("checkLimit: downgraded and over the limit keeps rows, just can't add", () => {
  // Pro company with 40 contractors downgrades to Business (25).
  const r = checkLimit({ plan: "business", status: "active", resource: "contractors", used: 40 });
  assert.equal(r.allowed, false);
  assert.equal(r.used, 40);
  assert.equal(r.planError?.requiredPlan, "pro");
});

test("checkLimit: Starter over its project limit after a downgrade", () => {
  const r = checkLimit({ plan: "starter", status: "active", resource: "projects", used: 6 });
  assert.equal(r.allowed, false);
  assert.equal(r.planError?.requiredPlan, "business");
  const way = checkLimit({ plan: "starter", status: "active", resource: "projects", used: 12 });
  assert.equal(way.planError?.requiredPlan, "pro");
});

test("planToAdd skips plans that still wouldn't fit", () => {
  assert.equal(planToAdd("starter", "contractors", 5), "business");
  assert.equal(planToAdd("starter", "contractors", 30), "pro");
  assert.equal(planToAdd("pro", "contractors", 1_000), null);
  assert.equal(planToAdd(null, "contractors", 0), "starter");
});
