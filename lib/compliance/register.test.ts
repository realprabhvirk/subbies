import test from "node:test";
import assert from "node:assert/strict";

import { computeProjectCompliance, type EngineDocument } from "./project.ts";
import { buildRegister, filterAndPage, parsePage, parseRegisterFilter } from "./register.ts";

const NOW = new Date("2026-11-11T00:00:00Z");
const day = (o: number) => new Date(NOW.getTime() + o * 86_400_000).toISOString().slice(0, 10);
const d = (id: string, contractorId: string, documentTypeId: string, p: Partial<EngineDocument> = {}): EngineDocument => ({
  id, contractorId, documentTypeId, documentTypeName: documentTypeId.toUpperCase(), status: "approved", expiryDate: day(200),
  createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z", ...p,
});
const contractors = ["a", "b"].map((id) => ({ id, businessName: id === "a" ? "Alpha" : "Bravo", trade: null, status: "approved" as const, archived: false }));

test("requirements mode: one row per contractor and requirement, missing rows derived", () => {
  const documents = [d("1", "a", "pl"), d("2", "b", "pl", { expiryDate: day(-4) })];
  const compliance = computeProjectCompliance({
    requirements: [
      { id: "r1", documentTypeId: "pl", documentTypeName: "PL", isMandatory: true, minDaysValid: null },
      { id: "r2", documentTypeId: "wc", documentTypeName: "WC", isMandatory: true, minDaysValid: null },
    ],
    contractors, documents, now: NOW, mode: "requirements",
  });
  const rows = buildRegister({ compliance, documents, now: NOW });
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => [r.contractorName, r.documentTypeName, r.state]), [
    ["Bravo", "PL", "expired"],
    ["Alpha", "WC", "missing"],
    ["Bravo", "WC", "missing"],
    ["Alpha", "PL", "valid"],
  ]);
  assert.equal(rows[1].documentId, null);
  assert.equal(rows[3].reviewedAt, "2026-10-02T00:00:00Z");
});

test("basic mode: one row per live document, revoked skipped, requested shown as missing", () => {
  const documents = [
    d("1", "a", "pl", { status: "uploaded", expiryDate: null }),
    d("2", "a", "wc", { status: "requested", expiryDate: null }),
    d("3", "b", "pl", { status: "revoked", expiryDate: null }),
    d("4", "b", "wc", { expiryDate: day(10) }),
  ];
  const compliance = computeProjectCompliance({ requirements: [], contractors, documents, now: NOW, mode: "basic" });
  const rows = buildRegister({ compliance, documents, now: NOW });
  assert.deepEqual(rows.map((r) => r.state), ["missing", "pending_review", "expiring"]);
});

test("filters, counts and pages of 25", () => {
  const many = Array.from({ length: 60 }, (_, i) => d(`x${i}`, "a", `t${i}`, { expiryDate: i < 10 ? day(-1) : day(300) }));
  const compliance = computeProjectCompliance({ requirements: [], contractors: [contractors[0]], documents: many, now: NOW, mode: "basic" });
  const rows = buildRegister({ compliance, documents: many, now: NOW });
  const p1 = filterAndPage(rows, "all", 1);
  assert.equal(p1.rows.length, 25);
  assert.equal(p1.pages, 3);
  assert.equal(p1.counts.expired, 10);
  assert.equal(p1.counts.approved, 50);
  const p3 = filterAndPage(rows, "all", 3);
  assert.equal(p3.rows.length, 10);
  const over = filterAndPage(rows, "expired", 9);
  assert.equal(over.page, 1);
  assert.equal(over.rows.length, 10);
});

test("parsing the URL", () => {
  assert.equal(parseRegisterFilter("expired"), "expired");
  assert.equal(parseRegisterFilter("nope"), "all");
  assert.equal(parseRegisterFilter(["a", "b"]), "all");
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage("-1"), 1);
  assert.equal(parsePage("x"), 1);
});
