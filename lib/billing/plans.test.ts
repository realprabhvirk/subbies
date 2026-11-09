import test from "node:test";
import assert from "node:assert/strict";

import { PLANS, PLAN_IDS } from "./plans.ts";

test("projects: not in Starter, 10 on Business, unlimited on Pro", () => {
  assert.equal(PLANS.starter.limits.projects, 0);
  assert.equal(PLANS.business.limits.projects, 10);
  assert.equal(PLANS.pro.limits.projects, null);
});

test("each plan's feature list matches its project limit", () => {
  for (const id of PLAN_IDS) {
    const plan = PLANS[id];
    const projectLines = plan.features.filter((f) => /project/i.test(f) && !/^Everything/i.test(f) && !/per project/i.test(f));
    const limit = plan.limits.projects;
    if (limit === 0) {
      assert.deepEqual(projectLines, [], `${id} lists projects but they are not included`);
    } else if (limit === null) {
      assert.deepEqual(projectLines, ["Unlimited projects"], id);
    } else {
      assert.deepEqual(projectLines, [`${limit} projects`], id);
    }
  }
});

test("prices are unchanged", () => {
  assert.deepEqual(
    PLAN_IDS.map((id) => PLANS[id].amount),
    [19, 39, 79],
  );
});
