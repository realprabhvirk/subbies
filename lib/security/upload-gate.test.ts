/**
 * H1 on the contractor side: an upload link belonging to a company without a
 * live plan can't be used to store files. And the normal path, a paying
 * company's contractor uploading, still gets a signed upload URL.
 *
 * Runs the real requestDocumentUpload and the real companyHasAccess against
 * the in-memory fake; storage, the token lookup and the rate limiter are
 * stubbed.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { installServerModuleStubs } from "../test-support/server-module-stubs.ts";
import { resetFake, fakeModuleSource } from "../test-support/fake-supabase.ts";

const A = "2f7fc5a6-badc-46a4-8b27-afd25746ea8c";
const K = "3c570c69-34b9-49be-bbdb-dce0e6424dbd";
const DOC = "dccdcb9d-42b2-4f57-80f9-884e3ffba4e0";

const signed: string[] = [];
(globalThis as Record<string, unknown>).__signedUploads = signed;

const ownerEmails: unknown[] = [];
(globalThis as Record<string, unknown>).__ownerEmails = ownerEmails;

type Obj = { path: string; createdAt: string | null };
const storage = { objects: [] as Obj[], deleted: [] as string[], listFails: false };
(globalThis as Record<string, unknown>).__storage = storage;

installServerModuleStubs({
  "server-only": ``,
  react: `export function cache(fn){ return fn; }`,
  "next/cache": `export function revalidatePath(){}`,
  "@/lib/supabase/server": fakeModuleSource(`export async function createClient(){ return F.makeClient(); }`),
  "@/lib/supabase/admin": fakeModuleSource(`export function createAdminClient(){ return F.makeClient(); }`),
  "@/lib/supabase/dal": `export async function getCompany(){ return null; } export async function getUser(){ return null; } export async function getCompanyContext(){ return null; }`,
  "@/lib/onboarding": `
    export async function resolveOnboardingToken(){ return { contractorId: ${JSON.stringify(K)}, companyId: ${JSON.stringify(A)} }; }
    export async function getCompanyOwnerEmail(){ return "owner@acme.test"; }
  `,
  "@/lib/app-url": `export async function getAppUrl(){ return "https://app.test"; }`,
  "@/lib/contractor-status": `export async function recomputeContractorStatus(){ return null; }`,
  "@/lib/email/company": `export async function sendDocumentSubmittedEmail(input){ globalThis.__ownerEmails.push(input); return { ok: true }; }`,
  "@/lib/rate-limit": `
    export const RATE_LIMITS = { onboardAction: { bucket: "t", limit: 1000, windowSeconds: 60 } };
    export async function checkRateLimit(){ return true; }
  `,
  "@/lib/storage": `
    const st = () => globalThis.__storage;
    export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
    export function isAllowedMimeType(t){ return t === "application/pdf"; }
    export function buildDocumentPath(p){ return p.companyId + "/" + p.contractorId + "/" + p.contractorDocumentId + "/file.pdf"; }
    export async function createSignedUpload(path){ globalThis.__signedUploads.push(path); return { data: { path, signedUrl: "https://signed/" + path, token: "up" }, error: null }; }
    export async function createSignedDownload(){ return { data: null, error: null }; }
    export async function getObjectInfo(path){ return st().objects.some((o) => o.path === path) ? { size: 10, mimetype: "application/pdf" } : null; }
    export async function deleteObject(path){ st().deleted.push(path); st().objects = st().objects.filter((o) => o.path !== path); }
    export async function deleteObjects(paths){ for (const p of paths) { st().deleted.push(p); } st().objects = st().objects.filter((o) => !paths.includes(o.path)); return { deletedCount: paths.length, failedPaths: [] }; }
    export async function listObjectsUnder(prefix){ if (st().listFails) return null; return st().objects.filter((o) => o.path.startsWith(prefix + "/")); }
  `,
});

const { requestDocumentUpload, submitStagedDocuments } = await import("../../app/onboard/[token]/actions.ts");

const PREFIX = `${A}/${K}/${DOC}`;
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const pending = (n: number, ageMinutes: number, tag = "p") =>
  Array.from({ length: n }, (_, i) => ({ path: `${PREFIX}/${tag}${i}.pdf`, createdAt: minutesAgo(ageMinutes) }));

const FILE = { name: "policy.pdf", type: "application/pdf", size: 1000 };

function seed(status: string | null) {
  const s = resetFake();
  s.tables.subscriptions = status ? [{ company_id: A, status, plan: "starter" }] : [];
  s.tables.contractor_documents = [
    { id: DOC, contractor_id: K, status: "requested", archived_at: null, document_types: { name: "Public liability" } },
  ];
  signed.length = 0;
  storage.objects = [];
  storage.deleted = [];
  storage.listFails = false;
  ownerEmails.length = 0;
  return s;
}

for (const status of ["none", "canceled", null]) {
  test(`company status ${status ?? "(no subscription row)"}: no upload URL is issued`, async () => {
    seed(status);
    const r = await requestDocumentUpload("tok", DOC, FILE, true);
    assert.equal(r.ok, false);
    assert.match((r as { error: string }).error, /isn't active/);
    assert.equal(signed.length, 0, "storage was never asked for a URL");

    const submit = await submitStagedDocuments("tok", DOC, [], true);
    assert.equal(submit.ok, false);
    assert.match(submit.error ?? "", /isn't active/);
  });
}

for (const status of ["active", "trialing", "past_due"]) {
  test(`company status ${status}: the contractor gets a signed upload URL`, async () => {
    seed(status);
    const r = await requestDocumentUpload("tok", DOC, FILE, true);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(signed, [`${A}/${K}/${DOC}/file.pdf`]);
  });
}

// ---------------------------------------------------------------------------
// M1: unsubmitted uploads per document

test("M1: with 9 unsubmitted files under the document, one more upload is allowed", async () => {
  seed("active");
  storage.objects = pending(9, 1);
  const r = await requestDocumentUpload("tok", DOC, FILE, true);
  assert.equal(r.ok, true);
});

test("M1: with 10 fresh unsubmitted files, the 11th is refused and no URL is issued", async () => {
  seed("active");
  storage.objects = pending(10, 1);
  const r = await requestDocumentUpload("tok", DOC, FILE, true);
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /too many unfinished uploads/i);
  assert.equal(signed.length, 0);
  assert.equal(storage.deleted.length, 0, "fresh files from an upload in progress are never cleared");
});

test("M1: submitted files don't count toward the limit", async () => {
  const s = seed("active");
  storage.objects = pending(10, 1, "done");
  s.tables.contractor_document_files = storage.objects.map((o) => ({ contractor_document_id: DOC, file_path: o.path }));
  assert.equal((await requestDocumentUpload("tok", DOC, FILE, true)).ok, true);
});

test("M1: leftovers from a failed attempt are cleared so a retry isn't blocked", async () => {
  seed("active");
  storage.objects = [...pending(8, 30, "stale"), ...pending(2, 1, "fresh")];
  const r = await requestDocumentUpload("tok", DOC, FILE, true);
  assert.equal(r.ok, true);
  assert.equal(storage.deleted.length, 8);
  assert.ok(storage.deleted.every((p) => p.includes("/stale")), "only the stale ones were removed");
});

test("M1: a broken storage listing fails open rather than blocking the contractor", async () => {
  seed("active");
  storage.listFails = true;
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.equal((await requestDocumentUpload("tok", DOC, FILE, true)).ok, true);
  } finally {
    console.error = originalError;
  }
});

test("normal path: submitting registers the batch and clears leftovers, never the new files", async () => {
  const s = seed("active");
  const batch = [
    { path: `${PREFIX}/new-1.pdf`, fileName: "policy page 1.pdf" },
    { path: `${PREFIX}/new-2.pdf`, fileName: "policy page 2.pdf" },
  ];
  storage.objects = [
    ...batch.map((b) => ({ path: b.path, createdAt: minutesAgo(1) })),
    ...pending(3, 40, "abandoned"),
  ];
  const r = await submitStagedDocuments("tok", DOC, batch, true);
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(
    s.tables.contractor_document_files.map((f) => f.file_path).sort(),
    batch.map((b) => b.path).sort(),
  );
  assert.equal(s.tables.contractor_documents[0].status, "uploaded");
  for (const b of batch) assert.ok(!storage.deleted.includes(b.path), `${b.path} must survive`);
  assert.equal(storage.deleted.filter((p) => p.includes("/abandoned")).length, 3);
});

// ---------------------------------------------------------------------------
// M3: owner notifications on repeat submissions

async function submitOnce(name: string) {
  const path = `${PREFIX}/${name}.pdf`;
  storage.objects.push({ path, createdAt: minutesAgo(0) });
  const r = await submitStagedDocuments("tok", DOC, [{ path, fileName: `${name}.pdf` }], true);
  assert.deepEqual(r, { ok: true });
}

test("M3 normal path: a first upload notifies the owner once (email + in-app)", async () => {
  const s = seed("active");
  await submitOnce("first");
  assert.equal(ownerEmails.length, 1);
  assert.equal(s.tables.notifications.length, 1);
  assert.ok(s.tables.contractor_documents[0].last_owner_notified_at);
});

test("M3: resubmitting a document still awaiting review within the hour notifies nobody", async () => {
  const s = seed("active");
  await submitOnce("first");
  await submitOnce("second");
  await submitOnce("third");
  assert.equal(ownerEmails.length, 1, "one owner email, not three");
  assert.equal(s.tables.notifications.length, 1, "repeat notifications collapse");
});

test("M3: a resubmission more than an hour after the last notice notifies again", async () => {
  const s = seed("active");
  await submitOnce("first");
  s.tables.contractor_documents[0].last_owner_notified_at = minutesAgo(61);
  await submitOnce("second");
  assert.equal(ownerEmails.length, 2);
  assert.equal(s.tables.notifications.length, 2);
});

test("M3: an upload after a rejection always notifies, even within the hour", async () => {
  const s = seed("active");
  await submitOnce("first");
  s.tables.contractor_documents[0].status = "rejected";
  await submitOnce("fixed");
  assert.equal(ownerEmails.length, 2);
});

// ---------------------------------------------------------------------------
// L4: submitted names and paths

test("L4: re-submitting an already-registered path is refused and the file survives", async () => {
  const s = seed("active");
  const existing = `${PREFIX}/existing.pdf`;
  storage.objects = [{ path: existing, createdAt: minutesAgo(90) }];
  s.tables.contractor_document_files = [{ id: "f1", contractor_document_id: DOC, file_path: existing, file_name: "existing.pdf" }];
  const r = await submitStagedDocuments("tok", DOC, [{ path: existing, fileName: "existing.pdf" }], true);
  assert.equal(r.ok, false);
  assert.match(r.error ?? "", /already submitted/);
  assert.deepEqual(storage.deleted, []);
  assert.equal(s.tables.contractor_document_files.length, 1);
});

test("L4: a file name with a path separator or over 255 characters is refused before anything changes", async () => {
  seed("active");
  const path = `${PREFIX}/new.pdf`;
  storage.objects = [{ path, createdAt: minutesAgo(0) }];
  for (const fileName of ["../../secret.pdf", "x".repeat(256)]) {
    const r = await submitStagedDocuments("tok", DOC, [{ path, fileName }], true);
    assert.equal(r.ok, false);
  }
  assert.deepEqual(storage.deleted, []);
});

test("L4 normal path: replacing earlier files deletes the old ones, never the new batch", async () => {
  const s = seed("active");
  const old = `${PREFIX}/old.pdf`;
  const fresh = `${PREFIX}/fresh.pdf`;
  storage.objects = [{ path: old, createdAt: minutesAgo(90) }, { path: fresh, createdAt: minutesAgo(0) }];
  s.tables.contractor_document_files = [{ id: "f1", contractor_document_id: DOC, file_path: old, file_name: "old.pdf" }];
  assert.deepEqual(await submitStagedDocuments("tok", DOC, [{ path: fresh, fileName: "fresh.pdf" }], true), { ok: true });
  assert.ok(storage.deleted.includes(old));
  assert.ok(!storage.deleted.includes(fresh));
  assert.deepEqual(s.tables.contractor_document_files.map((f) => f.file_path), [fresh]);
});
