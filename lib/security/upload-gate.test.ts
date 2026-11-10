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

installServerModuleStubs({
  "server-only": ``,
  react: `export function cache(fn){ return fn; }`,
  "next/cache": `export function revalidatePath(){}`,
  "@/lib/supabase/server": fakeModuleSource(`export async function createClient(){ return F.makeClient(); }`),
  "@/lib/supabase/admin": fakeModuleSource(`export function createAdminClient(){ return F.makeClient(); }`),
  "@/lib/supabase/dal": `export async function getCompany(){ return null; } export async function getUser(){ return null; } export async function getCompanyContext(){ return null; }`,
  "@/lib/onboarding": `
    export async function resolveOnboardingToken(){ return { contractorId: ${JSON.stringify(K)}, companyId: ${JSON.stringify(A)} }; }
    export async function getCompanyOwnerEmail(){ return null; }
  `,
  "@/lib/app-url": `export async function getAppUrl(){ return "https://app.test"; }`,
  "@/lib/contractor-status": `export async function recomputeContractorStatus(){ return null; }`,
  "@/lib/email/company": `export async function sendDocumentSubmittedEmail(){ return { ok: true }; }`,
  "@/lib/rate-limit": `
    export const RATE_LIMITS = { onboardAction: { bucket: "t", limit: 1000, windowSeconds: 60 } };
    export async function checkRateLimit(){ return true; }
  `,
  "@/lib/storage": `
    export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
    export function isAllowedMimeType(t){ return t === "application/pdf"; }
    export function buildDocumentPath(p){ return p.companyId + "/" + p.contractorId + "/" + p.contractorDocumentId + "/file.pdf"; }
    export async function createSignedUpload(path){ globalThis.__signedUploads.push(path); return { data: { path, signedUrl: "https://signed/" + path, token: "up" }, error: null }; }
    export async function createSignedDownload(){ return { data: null, error: null }; }
    export async function getObjectInfo(){ return null; }
    export async function deleteObject(){}
  `,
});

const { requestDocumentUpload, submitStagedDocuments } = await import("../../app/onboard/[token]/actions.ts");

const FILE = { name: "policy.pdf", type: "application/pdf", size: 1000 };

function seed(status: string | null) {
  const s = resetFake();
  s.tables.subscriptions = status ? [{ company_id: A, status, plan: "starter" }] : [];
  s.tables.contractor_documents = [
    { id: DOC, contractor_id: K, status: "requested", archived_at: null, document_types: { name: "Public liability" } },
  ];
  signed.length = 0;
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
