/**
 * M2: a contractor's upload link stops working when their email changes, and
 * when the company revokes it. Runs the real updateContractorDetails,
 * revokeUploadLink and resolveOnboardingToken (the lookup every upload goes
 * through) against the in-memory fake.
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

const { updateContractorDetails, revokeUploadLink, resendDocumentRequests } = await import(
  "../../app/dashboard/contractors/[id]/manage-actions.ts"
);
const { resolveOnboardingToken } = await import("../onboarding.ts");

const A = "2f7fc5a6-badc-46a4-8b27-afd25746ea8c";
const B = "34c4652e-ae33-4973-82e5-53d8b1ed7a20";
const K = "3c570c69-34b9-49be-bbdb-dce0e6424dbd";
const OLD_TOKEN = "11111111-1111-4111-8111-111111111111";

function seed() {
  const s = resetFake({ company: { id: A, name: "Acme Builders" }, user: { id: "u1", email: "owner@acme.test" } });
  s.tables.subscriptions = [{ company_id: A, status: "active", plan: "starter", onboarding_completed_at: "2026-01-01" }];
  s.tables.contractors = [{
    id: K, company_id: A, business_name: "Sparky Co", contact_name: "Sam", email: "sam@sparky.test",
    phone: null, abn: null, status: "pending", companies: { name: "Acme Builders" },
  }];
  s.tables.contractor_tokens = [{ id: "t1", contractor_id: K, token: OLD_TOKEN, expires_at: "2099-01-01T00:00:00Z" }];
  return s;
}

const details = (email: string) => ({ businessName: "Sparky Co", contactName: "Sam", email, phone: "", abn: "" });

test("M2: after an email change the old link resolves to nothing, and nothing is emailed", async () => {
  const s = seed();
  assert.ok(await resolveOnboardingToken(OLD_TOKEN), "the link works before the change");

  const r = await updateContractorDetails(K, details("sam@new-address.test"));
  assert.equal(r.ok, true);

  assert.equal(await resolveOnboardingToken(OLD_TOKEN), null, "the old link is dead");
  const newToken = s.tables.contractor_tokens[0].token as string;
  assert.notEqual(newToken, OLD_TOKEN);
  const resolved = await resolveOnboardingToken(newToken);
  assert.equal(resolved?.contractorEmail, "sam@new-address.test", "the new link works");
  assert.equal(s.sent.length, 0, "the new link isn't sent automatically");
});

test("M2 normal path: saving other details (or the same email in a different case) keeps the link", async () => {
  const s = seed();
  const r = await updateContractorDetails(K, { ...details("SAM@sparky.test"), phone: "0400 000 000" });
  assert.equal(r.ok, true);
  assert.equal(s.tables.contractor_tokens[0].token, OLD_TOKEN);
  assert.ok(await resolveOnboardingToken(OLD_TOKEN));
});

test("M2: Revoke link kills the current link and leaves a working new one", async () => {
  const s = seed();
  assert.deepEqual(await revokeUploadLink(K), { ok: true });
  assert.equal(await resolveOnboardingToken(OLD_TOKEN), null);
  assert.ok(await resolveOnboardingToken(s.tables.contractor_tokens[0].token as string));
  assert.equal(s.sent.length, 0);
});

test("M2: the next request carries the new link", async () => {
  const s = seed();
  s.tables.contractor_documents = [{ id: "d1", contractor_id: K, status: "requested", archived_at: null, replaces_document_id: null, expiry_date: null, document_types: { name: "Public liability" } }];
  await revokeUploadLink(K);
  const newToken = s.tables.contractor_tokens[0].token as string;
  const sent = await resendDocumentRequests(K, ["d1"]);
  assert.equal(sent.ok, true, JSON.stringify(sent));
  assert.ok(String(s.sent[0].text).includes(`/onboard/${newToken}`));
  assert.ok(!String(s.sent[0].text).includes(OLD_TOKEN));
});

test("M2: another company can't revoke this contractor's link", async () => {
  const s = seed();
  s.company = { id: B, name: "Other Co" };
  s.tables.subscriptions.push({ company_id: B, status: "active", plan: "starter", onboarding_completed_at: "2026-01-01" });
  const r = await revokeUploadLink(K);
  assert.equal(r.ok, false);
  assert.equal(s.tables.contractor_tokens[0].token, OLD_TOKEN);
});
