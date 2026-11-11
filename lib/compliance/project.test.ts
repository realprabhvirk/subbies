import test from "node:test";
import assert from "node:assert/strict";

import {
  computeProjectCompliance,
  evaluateRequirement,
  describeDays,
  type EngineContractor,
  type EngineDocument,
  type EngineRequirement,
} from "./project.ts";

// "Today" is 2026-11-11 (UTC midnight of the Queensland date).
const NOW = new Date("2026-11-11T00:00:00Z");
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000).toISOString().slice(0, 10);

let n = 0;
function doc(p: Partial<EngineDocument> & { contractorId: string; documentTypeId: string }): EngineDocument {
  n += 1;
  return {
    id: `d${n}`,
    documentTypeName: p.documentTypeId === "pl" ? "Public liability insurance" : p.documentTypeId === "wc" ? "Workers compensation" : "SWMS",
    status: "approved",
    expiryDate: day(200),
    createdAt: `2026-10-${String(n % 28 + 1).padStart(2, "0")}T00:00:00Z`,
    updatedAt: `2026-10-${String(n % 28 + 1).padStart(2, "0")}T00:00:00Z`,
    ...p,
  };
}
const contractor = (id: string, p: Partial<EngineContractor> = {}): EngineContractor => ({
  id, businessName: `Contractor ${id}`, trade: null, status: "approved", archived: false, ...p,
});
const req = (documentTypeId: string, p: Partial<EngineRequirement> = {}): EngineRequirement => ({
  id: `r-${documentTypeId}`, documentTypeId, documentTypeName: documentTypeId, isMandatory: true, minDaysValid: null, ...p,
});

const evalOne = (docs: EngineDocument[], min: number | null = null) => evaluateRequirement(docs, NOW, 30, min);

test("states: valid, expiring, pending_review, rejected, expired, missing", () => {
  const c = "c1", t = "pl";
  const cases: [string, EngineDocument[], string][] = [
    ["approved, valid beyond window", [doc({ contractorId: c, documentTypeId: t, expiryDate: day(31) })], "valid"],
    ["approved, no expiry date", [doc({ contractorId: c, documentTypeId: t, expiryDate: null })], "valid"],
    ["approved, exactly 30 days left", [doc({ contractorId: c, documentTypeId: t, expiryDate: day(30) })], "expiring"],
    ["approved, expires today", [doc({ contractorId: c, documentTypeId: t, expiryDate: day(0) })], "expiring"],
    ["only an upload waiting", [doc({ contractorId: c, documentTypeId: t, status: "uploaded", expiryDate: null })], "pending_review"],
    ["latest is rejected", [doc({ contractorId: c, documentTypeId: t, status: "rejected", expiryDate: null })], "rejected"],
    ["approved, expired yesterday", [doc({ contractorId: c, documentTypeId: t, expiryDate: day(-1) })], "expired"],
    ["requested only (nothing provided)", [doc({ contractorId: c, documentTypeId: t, status: "requested", expiryDate: null })], "missing"],
    ["revoked only", [doc({ contractorId: c, documentTypeId: t, status: "revoked", expiryDate: null })], "missing"],
    ["nothing at all", [], "missing"],
  ];
  for (const [name, docs, want] of cases) assert.equal(evalOne(docs).state, want, name);
});

test("a valid approved copy wins over a rejected or pending one", () => {
  const docs = [
    doc({ contractorId: "c", documentTypeId: "pl", expiryDate: day(100) }),
    doc({ contractorId: "c", documentTypeId: "pl", status: "rejected", expiryDate: null }),
  ];
  assert.equal(evalOne(docs).state, "valid");
});

test("pending upload beats an older expired approval", () => {
  const docs = [
    doc({ contractorId: "c", documentTypeId: "pl", expiryDate: day(-10) }),
    doc({ contractorId: "c", documentTypeId: "pl", status: "uploaded", expiryDate: null }),
  ];
  assert.equal(evalOne(docs).state, "pending_review");
});

test("renewal pending: expiring copy plus a newer upload", () => {
  const old = doc({ contractorId: "c", documentTypeId: "pl", expiryDate: day(5), createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" });
  const renewal = doc({ contractorId: "c", documentTypeId: "pl", status: "uploaded", expiryDate: null, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" });
  const r = evalOne([old, renewal]);
  assert.equal(r.state, "expiring");
  assert.equal(r.renewalPending, true);
  assert.equal(r.documentId, old.id);
});

test("min_days_valid: an approved copy short of the minimum is expiring, not valid", () => {
  const d = [doc({ contractorId: "c", documentTypeId: "pl", expiryDate: day(60) })];
  assert.equal(evalOne(d, null).state, "valid");
  assert.equal(evalOne(d, 90).state, "expiring");
  assert.equal(evalOne(d, 60).state, "valid");
});

test("the best of several approved copies decides", () => {
  const docs = [
    doc({ contractorId: "c", documentTypeId: "pl", expiryDate: day(10) }),
    doc({ contractorId: "c", documentTypeId: "pl", expiryDate: day(300) }),
  ];
  assert.equal(evalOne(docs).daysLeft, 300);
});

test("contractor status precedence and optional requirements", () => {
  const reqs = [req("pl"), req("wc"), req("swms", { isMandatory: false })];
  const docs = [
    doc({ contractorId: "a", documentTypeId: "pl" }), doc({ contractorId: "a", documentTypeId: "wc" }), // compliant, optional missing
    doc({ contractorId: "b", documentTypeId: "pl" }), doc({ contractorId: "b", documentTypeId: "wc", expiryDate: day(10) }), // expiring
    doc({ contractorId: "c", documentTypeId: "pl" }), doc({ contractorId: "c", documentTypeId: "wc", status: "uploaded", expiryDate: null }), // pending
    doc({ contractorId: "d", documentTypeId: "pl", expiryDate: day(10) }), // wc missing: not cleared, beats expiring
    doc({ contractorId: "e", documentTypeId: "pl" }), doc({ contractorId: "e", documentTypeId: "wc" }), doc({ contractorId: "e", documentTypeId: "swms", expiryDate: day(-3) }), // optional expired: still compliant
  ];
  const r = computeProjectCompliance({ requirements: reqs, contractors: ["a", "b", "c", "d", "e"].map((x) => contractor(x)), documents: docs, now: NOW, mode: "requirements" });
  const status = Object.fromEntries(r.contractors.map((c) => [c.contractorId, c.status]));
  assert.deepEqual(status, { a: "compliant", b: "expiring", c: "pending_review", d: "not_cleared", e: "compliant" });
  assert.equal(r.clearedCount, 3);
  assert.equal(r.percent, 60);
  assert.equal(r.contractors.find((c) => c.contractorId === "d")!.mandatoryMet, 1);
  assert.equal(r.contractors.find((c) => c.contractorId === "d")!.mandatoryTotal, 2);
  // a+b+c+e meet both mandatory (c's wc pending doesn't), d misses one.
  assert.equal(r.outstandingMandatory, 2);
});

test("archived contractors are excluded from every figure", () => {
  const r = computeProjectCompliance({
    requirements: [req("pl")],
    contractors: [contractor("a"), contractor("z", { archived: true })],
    documents: [doc({ contractorId: "a", documentTypeId: "pl" })],
    now: NOW,
    mode: "requirements",
  });
  assert.equal(r.assignedCount, 1);
  assert.equal(r.percent, 100);
  assert.ok(!r.contractors.some((c) => c.contractorId === "z"));
  assert.ok(!r.needsAttention.some((i) => i.contractorId === "z"));
});

test("zero contractors: percent is null, never 0 or 100", () => {
  const r = computeProjectCompliance({ requirements: [req("pl")], contractors: [], documents: [], now: NOW, mode: "requirements" });
  assert.equal(r.percent, null);
  assert.equal(r.assignedCount, 0);
});

test("zero requirements falls back to basic mode (the contractor's own status)", () => {
  const r = computeProjectCompliance({
    requirements: [],
    contractors: [contractor("a"), contractor("b", { status: "awaiting_review" }), contractor("c", { status: "pending" }), contractor("d")],
    documents: [doc({ contractorId: "d", documentTypeId: "pl", expiryDate: day(-2) }), doc({ contractorId: "a", documentTypeId: "pl", expiryDate: day(12) })],
    now: NOW,
    mode: "requirements",
  });
  assert.equal(r.mode, "basic");
  const status = Object.fromEntries(r.contractors.map((c) => [c.contractorId, c.status]));
  assert.deepEqual(status, { a: "expiring", b: "pending_review", c: "not_cleared", d: "not_cleared" });
  assert.equal(r.expiringCount, 1);
  assert.equal(r.needsAttention[0].issue, "expired");
  assert.equal(r.needsAttention[0].text, "Public liability insurance: expired 2 days ago");
});

test("basic mode requested explicitly ignores requirements", () => {
  const r = computeProjectCompliance({ requirements: [req("pl")], contractors: [contractor("a")], documents: [], now: NOW, mode: "basic" });
  assert.equal(r.mode, "basic");
  assert.equal(r.contractors[0].status, "compliant");
});

test("one contractor, two projects with different requirements, two answers", () => {
  const contractors = [contractor("a")];
  const documents = [doc({ contractorId: "a", documentTypeId: "pl" })];
  const p1 = computeProjectCompliance({ requirements: [req("pl")], contractors, documents, now: NOW, mode: "requirements" });
  const p2 = computeProjectCompliance({ requirements: [req("pl"), req("wc")], contractors, documents, now: NOW, mode: "requirements" });
  assert.equal(p1.contractors[0].status, "compliant");
  assert.equal(p2.contractors[0].status, "not_cleared");
});

test("needs attention is most urgent first, with plain sentences", () => {
  const r = computeProjectCompliance({
    requirements: [req("pl", { documentTypeName: "Public liability insurance" }), req("wc", { documentTypeName: "Workers compensation" })],
    contractors: [contractor("a", { businessName: "Alpha" }), contractor("b", { businessName: "Bravo" })],
    documents: [
      doc({ contractorId: "a", documentTypeId: "pl", expiryDate: day(5) }),
      doc({ contractorId: "a", documentTypeId: "wc", status: "uploaded", expiryDate: null }),
      doc({ contractorId: "b", documentTypeId: "pl", expiryDate: day(-3) }),
    ],
    now: NOW,
    mode: "requirements",
  });
  assert.deepEqual(r.needsAttention.map((i) => [i.businessName, i.issue, i.text]), [
    ["Bravo", "expired", "Public liability insurance: expired 3 days ago"],
    ["Bravo", "missing", "Workers compensation: not provided"],
    ["Alpha", "pending_review", "Workers compensation: waiting for your review"],
    ["Alpha", "expiring", "Public liability insurance: expires in 5 days"],
  ]);
});

test("about 60 contractors computes in one pass", () => {
  const contractors = Array.from({ length: 60 }, (_, i) => contractor(`c${i}`));
  const documents = contractors.flatMap((c, i) => (i % 3 === 0 ? [] : [doc({ contractorId: c.id, documentTypeId: "pl" })]));
  const r = computeProjectCompliance({ requirements: [req("pl")], contractors, documents, now: NOW, mode: "requirements" });
  assert.equal(r.assignedCount, 60);
  assert.equal(r.clearedCount, 40);
  assert.equal(r.percent, 67);
});

test("describeDays", () => {
  assert.equal(describeDays(-1), "expired 1 day ago");
  assert.equal(describeDays(0), "expires today");
  assert.equal(describeDays(1), "expires in 1 day");
});
