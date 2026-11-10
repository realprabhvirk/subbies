import test from "node:test";
import assert from "node:assert/strict";

import { parseContractorFilter, CONTRACTOR_FILTERS } from "./contractor-filter.ts";

test("known filter ids pass through", () => {
  for (const f of CONTRACTOR_FILTERS) assert.equal(parseContractorFilter(f.id), f.id);
});

test("unknown, repeated or missing values mean all", () => {
  assert.equal(parseContractorFilter(undefined), "all");
  assert.equal(parseContractorFilter("nope"), "all");
  assert.equal(parseContractorFilter(["approved", "expired"]), "all");
  assert.equal(parseContractorFilter("APPROVED"), "all");
});
