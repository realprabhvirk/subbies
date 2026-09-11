import test from "node:test";
import assert from "node:assert/strict";

import { deriveContractorStatus } from "./contractor-status.ts";

const future = "2999-01-01";
const past = "2000-01-01";

test("no documents at all -> pending", () => {
  assert.equal(deriveContractorStatus([]), "pending");
});

test("only revoked documents -> pending, same as no documents", () => {
  assert.equal(
    deriveContractorStatus([
      { status: "revoked", expiry_date: null },
      { status: "revoked", expiry_date: null },
    ]),
    "pending",
  );
});

test("a revoked document alongside an approved one -> approved (revoked ignored)", () => {
  assert.equal(
    deriveContractorStatus([
      { status: "revoked", expiry_date: null },
      { status: "approved", expiry_date: future },
    ]),
    "approved",
  );
});

test("a revoked document never masks a real expired one", () => {
  assert.equal(
    deriveContractorStatus([
      { status: "revoked", expiry_date: null },
      { status: "approved", expiry_date: past },
    ]),
    "expired",
  );
});

test("a revoked document alongside a still-outstanding request -> pending", () => {
  assert.equal(
    deriveContractorStatus([
      { status: "revoked", expiry_date: null },
      { status: "requested", expiry_date: null },
    ]),
    "pending",
  );
});

test("revoked never outranks rejected in the worst-first precedence", () => {
  assert.equal(
    deriveContractorStatus([
      { status: "revoked", expiry_date: null },
      { status: "rejected", expiry_date: null },
      { status: "approved", expiry_date: future },
    ]),
    "attention_required",
  );
});

test("everything approved and current, nothing revoked -> approved", () => {
  assert.equal(
    deriveContractorStatus([
      { status: "approved", expiry_date: future },
      { status: "approved", expiry_date: future },
    ]),
    "approved",
  );
});

test("existing precedence still holds with no revoked rows present", () => {
  assert.equal(
    deriveContractorStatus([
      { status: "uploaded", expiry_date: null },
      { status: "requested", expiry_date: null },
    ]),
    "awaiting_review",
  );
});
