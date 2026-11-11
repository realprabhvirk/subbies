/**
 * Contractor archiving (upgrade Phase 1): archived contractors stop counting
 * towards the plan, can't be emailed, their upload link goes inactive, and
 * restoring is checked against the plan limit with a typed error. Runs the
 * real server actions, entitlements and token lookup against the in-memory
 * fake (which mirrors the 0021 RPCs).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { installServerModuleStubs } from "../test-support/server-module-stubs.ts";
import { resetFake, fakeModuleSource } from "../test-support/fake-supabase.ts";

process.env.RESEND_API_KEY = "re_test_placeholder";

installServerModuleStubs({
  "server-only": ``,
  react: `export function cache(fn){ return fn; }`,
  "next/cache": `export function revalidatePath(){}`,
  resend: fakeModuleSource(`export const Resend = F.FakeResend;`),
  "@/lib/supabase/server": fakeModuleSource(`export async function createClient(){ return F.makeClient(); }`),
  "@/lib/supabase/admin": fakeModuleSource(`export function createAdminClient(){ return F.makeClient(); }`),
  "@/lib/supabase/dal": fakeModuleSource(`
    export async function getCompany(){ return F.fake().company; }
    export async function getUser(){ return F.fake().user; }
    export async function getCompanyContext(){
      const s = F.fake();
      if (!s.company) return null;
      return { company: s.company, subscription: (s.tables.subscriptions ?? []).find((r) => r.company_id === s.company.id) ?? null };
    }
  `),
  "@/lib/app-url": `export async function getAppUrl(){ return "https://app.test"; }`,
  "@/lib/contractor-status": `export async function recomputeContractorStatus(){ return null; }`,
  "@/lib/storage": `export async function deleteContractorFiles(){ return { deletedCount: 0, failedPaths: [], listFailed: false }; }`,
});

const { archiveContractor, restoreContractor, resendDocumentRequests } = await import(
  "../../app/dashboard/contractors/[id]/manage-actions.ts"
);
const { canAddContractor } = await import("../billing/entitlements.ts");
const { resolveOnboardingToken, getOnboardingContext } = await import("../onboarding.ts");

const A = "2f7fc5a6-badc-46a4-8b27-afd25746ea8c";
const B = "34c4652e-ae33-4973-82e5-53d8b1ed7a20";
const ids = [1, 2, 3, 4, 5].map((n) => `3c570c69-34b9-49be-bbdb-dce0e642400${n}`);
const OTHER = "3c570c69-34b9-49be-bbdb-dce0e6424099";
const TOKEN = "11111111-1111-4111-8111-111111111111";

function seed(plan = "starter") {
  const s = resetFake({ company: { id: A, name: "Acme Builders" }, user: { id: "u1", email: "owner@acme.test" } });
  s.tables.subscriptions = [{ company_id: A, status: "active", plan, onboarding_completed_at: "2026-01-01" }];
  s.tables.contractors = [
    ...ids.map((id, i) => ({
      id, company_id: A, business_name: `Sub ${i + 1}`, contact_name: null, email: `s${i}@sub.test`,
      phone: null, abn: null, status: "pending", archived_at: null, companies: { name: "Acme Builders" },
    })),
    { id: OTHER, company_id: B, business_name: "Not yours", contact_name: null, email: "x@other.test", phone: null, abn: null, status: "pending", archived_at: null },
  ];
  s.tables.contractor_tokens = [{ id: "t1", contractor_id: ids[0], token: TOKEN, expires_at: "2099-01-01T00:00:00Z" }];
  s.tables.contractor_documents = [
    { id: "d1", contractor_id: ids[0], status: "requested", archived_at: null, replaces_document_id: null, document_types: { name: "Insurance" } },
  ];
  return s;
}

test("Starter at 5/5: archiving one frees a slot, and the count skips archived rows", async () => {
  seed();
  assert.equal((await canAddContractor(A)).allowed, false);
  assert.deepEqual(await archiveContractor(ids[0]), { ok: true });
  const after = await canAddContractor(A);
  assert.equal(after.allowed, true);
  assert.equal(after.used, 4);
});

test("archiving keeps every row: nothing is deleted", async () => {
  const s = seed();
  await archiveContractor(ids[0]);
  assert.equal(s.tables.contractors.length, 6);
  assert.equal(s.tables.contractor_documents.length, 1);
  assert.ok(s.tables.contractors.find((c) => c.id === ids[0])!.archived_at);
});

test("an archived contractor's upload link is no longer active", async () => {
  seed();
  assert.ok(await resolveOnboardingToken(TOKEN), "works before archiving");
  await archiveContractor(ids[0]);
  assert.equal(await resolveOnboardingToken(TOKEN), null, "uploads are refused");
  assert.deepEqual(await getOnboardingContext(TOKEN), { inactive: true, companyName: "Acme Builders" });
});

test("an archived contractor can't be sent requests", async () => {
  seed();
  await archiveContractor(ids[0]);
  const r = await resendDocumentRequests(ids[0], ["d1"]);
  assert.equal(r.ok, false);
  assert.match(String((r as { error?: string }).error), /archived/i);
});

test("restore at the limit returns a typed PLAN_LIMIT error and changes nothing", async () => {
  const s = seed();
  await archiveContractor(ids[0]);
  // Fill the freed slot.
  s.tables.contractors.push({ id: "new", company_id: A, business_name: "New", email: "n@sub.test", status: "pending", archived_at: null });
  const r = await restoreContractor(ids[0]);
  assert.equal(r.ok, false);
  const err = r as { planError?: { code: string; requiredPlan: string; currentPlan: string } };
  assert.equal(err.planError?.code, "PLAN_LIMIT");
  assert.equal(err.planError?.requiredPlan, "business");
  assert.equal(err.planError?.currentPlan, "starter");
  assert.ok(s.tables.contractors.find((c) => c.id === ids[0])!.archived_at, "still archived");
});

test("restore under the limit brings the contractor and their link back", async () => {
  seed();
  await archiveContractor(ids[0]);
  assert.deepEqual(await restoreContractor(ids[0]), { ok: true });
  assert.ok(await resolveOnboardingToken(TOKEN));
});

test("another company's contractor can't be archived or restored", async () => {
  seed();
  const a = await archiveContractor(OTHER);
  assert.equal(a.ok, false);
  const r = await restoreContractor(OTHER);
  assert.equal(r.ok, false);
});
