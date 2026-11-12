import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

import { computeProjectCompliance, type EngineContractor, type EngineDocument } from "../compliance/project.ts";
import { buildReportModel } from "./report-model.ts";
import { renderReport, PDF_BUDGET_BYTES } from "./render.ts";

const NOW = new Date("2026-11-11T00:00:00Z");
const day = (o: number) => new Date(NOW.getTime() + o * 86_400_000).toISOString().slice(0, 10);

function fixture(n: number, longNames = false) {
  const contractors: EngineContractor[] = Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    businessName: longNames
      ? `The Absolutely Enormous Scaffolding, Formwork and Concrete Pumping Company of South East Queensland Pty Ltd ${i}`
      : `Contractor ${i} & Sons`,
    trade: i % 2 ? "Electrical" : null,
    status: "approved",
    archived: false,
  }));
  const documents: EngineDocument[] = contractors.flatMap((c, i) => [
    { id: `d${i}a`, contractorId: c.id, documentTypeId: "pl", documentTypeName: "Public liability insurance", status: "approved", expiryDate: day(i % 5 === 0 ? -3 : 120), createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
    ...(i % 3 === 0 ? [] : [{ id: `d${i}b`, contractorId: c.id, documentTypeId: "wc", documentTypeName: "Workers compensation", status: i % 4 === 0 ? "uploaded" : "approved", expiryDate: day(10), createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" } as EngineDocument]),
  ]);
  const compliance = computeProjectCompliance({
    requirements: [
      { id: "r1", documentTypeId: "pl", documentTypeName: "Public liability insurance", isMandatory: true, minDaysValid: null },
      { id: "r2", documentTypeId: "wc", documentTypeName: "Workers compensation", isMandatory: true, minDaysValid: 30 },
      { id: "r3", documentTypeId: "sw", documentTypeName: "SWMS", isMandatory: false, minDaysValid: null },
    ],
    contractors, documents, now: NOW, mode: "requirements",
  });
  return { compliance, documents };
}

const project = { name: "Burleigh Heads Apartments", address: "12 Goodwin Terrace, Burleigh Heads QLD", status: "active", start_date: "2026-08-13", end_date: null };
const photo = (colour: string) => sharp({ create: { width: 2400, height: 1600, channels: 3, background: colour } }).jpeg().toBuffer();
const noisy = async () => {
  const raw = Buffer.alloc(2000 * 2000 * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 251;
  return sharp(raw, { raw: { width: 2000, height: 2000, channels: 3 } }).jpeg({ quality: 100 }).toBuffer();
};

async function render(n: number, opts: { map?: Buffer | null; photos?: Buffer[]; longNames?: boolean } = {}) {
  const { compliance, documents } = fixture(n, opts.longNames);
  const model = buildReportModel({
    companyName: "Virk Constructions Pty Ltd", project, locationAddress: null, compliance, documents,
    now: NOW, generatedAt: new Date("2026-11-11T03:30:00Z"), map: opts.map ?? null, photos: opts.photos ?? [],
  });
  const pdf = await renderReport(model);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length < PDF_BUDGET_BYTES, `size ${pdf.length}`);
  return { pdf, model };
}

const pageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

test("0 contractors, no map, no photos", async () => {
  const { pdf, model } = await render(0);
  assert.equal(model.percent, null);
  assert.equal(pageCount(pdf), 1);
});

test("25 contractors flow across pages", async () => {
  const { pdf, model } = await render(25);
  assert.equal(model.contractors.length, 25);
  assert.ok(pageCount(pdf) >= 3, `pages ${pageCount(pdf)}`);
});

test("long names render", async () => {
  await render(6, { longNames: true });
});

test("map and three photos", async () => {
  const map = await sharp({ create: { width: 1280, height: 720, channels: 3, background: "#e8e4da" } }).png().toBuffer();
  const { model } = await render(3, { map, photos: [await photo("#556b2f"), await photo("#6d7f93"), await photo("#8a7f6a")] });
  assert.equal(model.photos.length, 3);
});

test("a map or photo that won't decode is skipped, the PDF still renders", async () => {
  const broken = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  await render(3, { map: broken, photos: [broken, await photo("#556b2f")] });
});

test("heavy photos stay inside the size budget", async () => {
  const big = await noisy();
  const { pdf } = await render(10, { photos: [big, big, big] });
  assert.ok(pdf.length < PDF_BUDGET_BYTES);
});

test("the model holds no private fields", async () => {
  const { model } = await render(3);
  const json = JSON.stringify({ ...model, map: null, photos: [] });
  assert.doesNotMatch(json, /@|email|phone|abn|policy|file_url|storage_path/i);
  assert.equal(model.hasLocation, false);
  for (const c of model.contractors) assert.deepEqual(Object.keys(c).sort(), ["name", "rows", "status", "trade"]);
  for (const r of model.contractors.flatMap((c) => c.rows)) assert.deepEqual(Object.keys(r).sort(), ["document", "expiry", "mandatory", "note", "status"]);
});

test("statuses are printed as words, with notes", async () => {
  const { model } = await render(5);
  const c0 = model.contractors[0];
  assert.equal(c0.rows[0].note, "Expired 3 days ago");
  assert.equal(c0.rows[1].status, "missing");
  assert.equal(c0.rows[1].note, "Missing");
  assert.equal(model.metrics.find((m) => m.label === "Contractors")?.value, 5);
});

test("optional documents never count as missing", async () => {
  const { model } = await render(4);
  const optionalMissing = model.contractors.flatMap((c) => c.rows).filter((r) => !r.mandatory && r.status === "missing");
  assert.ok(optionalMissing.length > 0);
  assert.equal(optionalMissing[0].note, "Optional, not provided");
  const mandatoryMissing = model.contractors.flatMap((c) => c.rows).filter((r) => r.mandatory && r.status === "missing").length;
  assert.equal(model.metrics.find((m) => m.label === "Missing")?.value, mandatoryMissing);
});
