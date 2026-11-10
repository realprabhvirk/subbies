/**
 * C1 regression test at the server-action layer.
 *
 * Runs the REAL getDocumentFileUrl (dashboard) and getSubmittedFileUrl
 * (contractor upload) with their framework/data imports stubbed, and proves
 * that a file row whose file_path points at ANOTHER company's folder is
 * refused BEFORE a signed URL is minted — even though ownership of the row
 * itself checks out. A signing stub records every path it is asked to sign;
 * the assertion is that a foreign path is never passed to it.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  installServerModuleStubs,
  FAKE_SUPABASE_CLIENT_SOURCE,
} from "./test-support/server-module-stubs.ts";

const A = "2f7fc5a6-badc-46a4-8b27-afd25746ea8c"; // viewing company
const B = "34c4652e-ae33-4973-82e5-53d8b1ed7a20"; // victim company
const K = "3c570c69-34b9-49be-bbdb-dce0e6424dbd";
const DOC = "dccdcb9d-42b2-4f57-80f9-884e3ffba4e0";
const ownPath = `${A}/${K}/${DOC}/aaaaaaaa-1111-4111-8111-111111111111.pdf`;
const foreignPath = `${B}/${K}/${DOC}/bbbbbbbb-2222-4222-8222-222222222222.pdf`;

// Shared mutable state the stubs read from.
(globalThis as Record<string, unknown>).__stubs = { rows: {}, signed: [] as string[] };
const stubs = () => (globalThis as Record<string, unknown>).__stubs as {
  rows: Record<string, unknown>;
  signed: string[];
  company?: { id: string; name: string };
  resolved?: { contractorId: string; companyId: string };
};

installServerModuleStubs({
  "server-only": ``,
  "next/cache": `export function revalidatePath(){}`,
  "./manage-actions": `export async function resendDocumentRequests(){ return { ok: true }; }`,
  "@/lib/storage": `
    export async function createSignedDownload(path){ globalThis.__stubs.signed.push(path); return { data: { signedUrl: "https://signed/" + path }, error: null }; }
    export function createSignedUpload(){ return { data: null, error: null }; }
    export function getObjectInfo(){ return null; }
    export function deleteObject(){}
    export const MAX_UPLOAD_BYTES = 999; export function isAllowedMimeType(){ return true; }
    export function buildDocumentPath(){ return ""; }
  `,
  "@/lib/supabase/server": `import { makeClient } from ${JSON.stringify("virtual-supa")}; export async function createClient(){ return makeClient(); }`,
  "@/lib/supabase/admin": `import { makeClient } from ${JSON.stringify("virtual-supa")}; export function createAdminClient(){ return makeClient(); }`,
  "virtual-supa": FAKE_SUPABASE_CLIENT_SOURCE,
  "@/lib/supabase/dal": `export async function getCompany(){ return globalThis.__stubs.company; } export async function getUser(){ return { id: "u", email: "x@test.local" }; }`,
  "@/lib/onboarding": `
    export async function resolveOnboardingToken(){ return globalThis.__stubs.resolved; }
    export async function getCompanyOwnerEmail(){ return null; }
  `,
  "@/lib/app-url": `export async function getAppUrl(){ return "https://app.test"; }`,
  // The plan gate (H1) has its own tests; here every company is paying.
  "@/lib/billing/require-active": `
    export async function requireActiveCompany(){ const c = globalThis.__stubs.company; return c ? { ok: true, company: c, user: { id: "u", email: "x@test.local" } } : { ok: false, error: "no session" }; }
    export async function companyHasAccess(){ return true; }
  `,
  "@/lib/email/send-cap": `export const DAILY_LIMIT_MESSAGE = "limit";`,
  "@/lib/contractor-status": `export async function recomputeContractorStatus(){ return null; }`,
  "@/lib/email/company": `export async function sendDocumentSubmittedEmail(){ return { ok: true }; }`,
  "@/lib/contractors/request-email": `export async function refreshTokenExpiry(){}`,
  // The contractor actions rate-limit by token (lib/rate-limit.ts, which needs
  // next/headers and the database). These tests are about path ownership, so
  // the limiter is stubbed to always allow.
  "@/lib/rate-limit": `
    export const RATE_LIMITS = { onboardAction: { bucket: "t", limit: 1000, windowSeconds: 60 }, contact: { bucket: "c", limit: 1000, windowSeconds: 60 } };
    export async function checkRateLimit(){ return true; }
    export async function clientIp(){ return "test"; }
  `,
});

test("dashboard getDocumentFileUrl refuses a file_path outside the caller's company", async () => {
  const s = stubs();
  s.signed.length = 0;
  s.company = { id: A, name: "Company A" };
  // The file row's ownership chain resolves to Company A (so the row check
  // passes) but its file_path is in Company B's folder.
  s.rows = {
    contractor_document_files: {
      file_path: foreignPath,
      contractor_documents: { contractor_id: K, contractors: { company_id: A } },
    },
  };
  const { getDocumentFileUrl } = await import(
    "../app/dashboard/contractors/[id]/actions.ts"
  );
  const res = await getDocumentFileUrl("file-id");
  assert.equal(res.ok, false);
  assert.deepEqual(s.signed, [], "a foreign path must never be signed");
});

test("dashboard getDocumentFileUrl still serves a legitimate own path", async () => {
  const s = stubs();
  s.signed.length = 0;
  s.company = { id: A, name: "Company A" };
  s.rows = {
    contractor_document_files: {
      file_path: ownPath,
      contractor_documents: { contractor_id: K, contractors: { company_id: A } },
    },
  };
  const { getDocumentFileUrl } = await import(
    "../app/dashboard/contractors/[id]/actions.ts"
  );
  const res = await getDocumentFileUrl("file-id");
  assert.equal(res.ok, true);
  assert.deepEqual(s.signed, [ownPath]);
});

test("contractor getSubmittedFileUrl refuses a file_path outside the owning company", async () => {
  const s = stubs();
  s.signed.length = 0;
  s.resolved = { contractorId: K, companyId: A };
  s.rows = {
    contractor_document_files: {
      file_path: foreignPath,
      contractor_documents: { contractor_id: K, archived_at: null },
    },
  };
  const { getSubmittedFileUrl } = await import("../app/onboard/[token]/actions.ts");
  const res = await getSubmittedFileUrl("token", "file-id");
  assert.equal(res.ok, false);
  assert.deepEqual(s.signed, [], "a foreign path must never be signed");
});

test("contractor getSubmittedFileUrl still serves a legitimate own path", async () => {
  const s = stubs();
  s.signed.length = 0;
  s.resolved = { contractorId: K, companyId: A };
  s.rows = {
    contractor_document_files: {
      file_path: ownPath,
      contractor_documents: { contractor_id: K, archived_at: null },
    },
  };
  const { getSubmittedFileUrl } = await import("../app/onboard/[token]/actions.ts");
  const res = await getSubmittedFileUrl("token", "file-id");
  assert.equal(res.ok, true);
  assert.deepEqual(s.signed, [ownPath]);
});
