import test from "node:test";
import assert from "node:assert/strict";

import { promptCopy } from "./upgrade-copy.ts";

test("contractor limit on Starter: names the limit, points at Business", () => {
  const c = promptCopy({ code: "PLAN_LIMIT", resource: "contractors", requiredPlan: "business", currentPlan: "starter", limit: 5, used: 5 });
  assert.deepEqual(c, {
    plan: "business",
    title: "Contractor limit reached",
    why: "Your plan allows 5 contractors and you have 5.",
    bullets: ["25 contractors", "15 document types", "10 projects"],
  });
});

test("project limit on Starter reads naturally for a limit of 1", () => {
  const c = promptCopy({ code: "PLAN_LIMIT", resource: "projects", requiredPlan: "business", currentPlan: "starter", limit: 1, used: 1 });
  assert.equal(c?.why, "Your plan allows 1 project and you have 1.");
  assert.equal(c?.bullets[0], "10 projects");
});

test("Pro bullets say unlimited", () => {
  const c = promptCopy({ code: "PLAN_LIMIT", resource: "contractors", requiredPlan: "pro", currentPlan: "business", limit: 25, used: 25 });
  assert.equal(c?.bullets[0], "Unlimited contractors");
});

test("feature prompt names the feature and the plan, and lists only live things", () => {
  const c = promptCopy({ code: "PLAN_FEATURE", feature: "pdfExport", requiredPlan: "business", currentPlan: "starter" });
  assert.equal(c?.title, "PDF reports: available on Business");
  assert.equal(c?.why, "Your Starter plan doesn't include this.");
  assert.deepEqual(c?.bullets, ["PDF reports", "25 contractors", "10 projects"]);
});

test("no prompt when no plan would unlock it", () => {
  assert.equal(promptCopy({ code: "PLAN_LIMIT", resource: "contractors", requiredPlan: null, currentPlan: "pro", limit: null, used: 1 }), null);
});

test("copy rules: no exclamation marks, no emoji", () => {
  const c = promptCopy({ code: "PLAN_LIMIT", resource: "documentTypes", requiredPlan: "business", currentPlan: "starter", limit: 7, used: 7 })!;
  const all = [c.title, c.why, ...c.bullets].join(" ");
  assert.doesNotMatch(all, /!/);
  assert.doesNotMatch(all, /\p{Extended_Pictographic}/u);
});
