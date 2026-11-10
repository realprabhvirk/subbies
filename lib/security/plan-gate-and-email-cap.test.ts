/**
 * H1 / H2 regression tests at the server-action layer.
 *
 * Runs the REAL server actions (createContractor, resendOnboardingRequest,
 * rejectDocument, approveDocument), the real plan gate (requireActiveCompany
 * with the real entitlement logic), the real request sender and the real
 * capped email sender. Only the framework, Supabase and Resend are swapped
 * for the in-memory fake in lib/test-support/fake-supabase.ts, which records
 * every email instead of sending it.
 *
 * Proves:
 *  - a company without an active plan is refused with zero emails sent;
 *  - two resends inside the cooldown send once;
 *  - the 201st capped email in 24 hours is refused before Resend is called;
 *  - rejectDocument still records the rejection at the cap, but sends nothing;
 *  - the normal paid paths (add a contractor, resend, approve, reject) still
 *    send exactly one email each.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { installServerModuleStubs } from "../test-support/server-module-stubs.ts";
import { fake, resetFake, fakeModuleSource } from "../test-support/fake-supabase.ts";

// A placeholder so getResend() returns a (fake) client. Not a real key.
process.env.RESEND_API_KEY = "re_test_placeholder";

const g = globalThis as unknown as { __nextContractorStatus?: string | null };

installServerModuleStubs({
  "server-only": ``,
  react: `export function cache(fn){ return fn; }`,
  "next/cache": `export function revalidatePath(){}`,
  "next/navigation": `export function redirect(url){ const e = new Error("NEXT_REDIRECT " + url); e.digest = "NEXT_REDIRECT;" + url; throw e; }`,
  resend: fakeModuleSource(`export const Resend = F.FakeResend;`),
  "@/lib/supabase/server": fakeModuleSource(`export async function createClient(){ return F.makeClient(); }`),
  "@/lib/supabase/admin": fakeModuleSource(`export function createAdminClient(){ return F.makeClient(); }`),
  "@/lib/supabase/dal": fakeModuleSource(`
    export async function getCompany(){ return F.fake().company; }
    export async function getUser(){ return F.fake().user; }
    export async function getCompanyContext(){
      const s = F.fake();
      if (!s.company) return null;
      const subscription = (s.tables.subscriptions ?? []).find((r) => r.company_id === s.company.id) ?? null;
      return { company: s.company, subscription };
    }
  `),
  "@/lib/app-url": `export async function getAppUrl(){ return "https://app.test"; }`,
  "@/lib/contractor-status": `export async function recomputeContractorStatus(){ return globalThis.__nextContractorStatus ?? null; }`,
  "@/lib/storage": `export async function createSignedDownload(){ return { data: null, error: null }; }`,
  "./manage-actions": `export async function resendDocumentRequests(){ return { ok: true }; }`,
});

const { createContractor, resendOnboardingRequest } = await import("../../app/dashboard/contractors/actions.ts");
const { rejectDocument, approveDocument } = await import("../../app/dashboard/contractors/[id]/actions.ts");
const { sendCappedEmail, COMPANY_DAILY_EMAIL_CAP, COMPANY_EMAIL_WINDOW_SECONDS, DAILY_LIMIT_MESSAGE } =
  await import("../email/send-cap.ts");
const { NO_ACCESS_MESSAGE } = await import("../billing/require-active.ts");
const { RESEND_COOLDOWN_SECONDS } = await import("../contractor-details-logic.ts");

const A = "2f7fc5a6-badc-46a4-8b27-afd25746ea8c";
const B = "34c4652e-ae33-4973-82e5-53d8b1ed7a20";
const K = "3c570c69-34b9-49be-bbdb-dce0e6424dbd";
const K2 = "4d681d7a-55ca-4e5c-9c3e-ecf8a7e5ce01";
const DT = "5e792e8b-66db-4f6d-8d4f-fd09b8f6df12";
const DOC = "dccdcb9d-42b2-4f57-80f9-884e3ffba4e0";

function seed(status: string) {
  const s = resetFake({
    company: { id: A, name: "Acme Builders" },
    user: { id: "u1", email: "owner@acme.test" },
  });
  g.__nextContractorStatus = null;
  s.tables.subscriptions = [{ company_id: A, status, plan: "starter", onboarding_completed_at: "2026-01-01T00:00:00Z" }];
  s.tables.document_types = [{ id: DT, company_id: A, name: "Public liability" }];
  s.tables.contractors = [
    { id: K, company_id: A, business_name: "Sparky Co", contact_name: "Sam", email: "sam@sparky.test", status: "pending" },
    { id: K2, company_id: A, business_name: "Pipes Ltd", contact_name: "Pat", email: "pat@pipes.test", status: "pending" },
  ];
  s.tables.contractor_documents = [
    { id: DOC, contractor_id: K, status: "uploaded", archived_at: null, replaces_document_id: null, document_types: { name: "Public liability" } },
  ];
  s.tables.contractor_tokens = [
    { id: "t1", contractor_id: K, token: "11111111-1111-4111-8111-111111111111", expires_at: "2099-01-01T00:00:00Z" },
    { id: "t2", contractor_id: K2, token: "22222222-2222-4222-8222-222222222222", expires_at: "2099-01-01T00:00:00Z" },
  ];
  return s;
}

function newContractorForm(): FormData {
  const f = new FormData();
  f.set("business_name", "Tiles R Us");
  f.set("contact_name", "Terry");
  f.set("email", "terry@tiles.test");
  f.append("document_type_ids", DT);
  return f;
}

async function runCreate(): Promise<{ redirectedTo?: string; result?: unknown }> {
  try {
    const result = await createContractor(null, newContractorForm());
    return { result };
  } catch (e) {
    const digest = (e as { digest?: string }).digest ?? "";
    if (!digest.startsWith("NEXT_REDIRECT;")) throw e;
    return { redirectedTo: digest.slice("NEXT_REDIRECT;".length) };
  }
}

/** Fills the company's 24h allowance so the next capped send is over it. */
function fillCap(companyId: string, count = COMPANY_DAILY_EMAIL_CAP) {
  const s = fake();
  const now = s.now();
  s.tables.email_send_log = Array.from({ length: count }, (_, i) => ({
    id: `log-${i}`,
    company_id: companyId,
    kind: "request",
    created_ms: now - 1000,
  }));
}

// ---------------------------------------------------------------------------
// H1: no active plan, no email

for (const status of ["none", "canceled", "incomplete_expired"]) {
  test(`status '${status}': createContractor, resend, reject and approve are refused with zero emails`, async () => {
    const s = seed(status);
    const contractorsBefore = s.tables.contractors.length;

    const created = await runCreate();
    assert.equal(created.redirectedTo, undefined, "a refused create must not redirect to success");
    assert.deepEqual(created.result, { ok: false, error: NO_ACCESS_MESSAGE });
    assert.equal(s.tables.contractors.length, contractorsBefore, "no contractor row was created");

    const resent = await resendOnboardingRequest(K);
    assert.deepEqual(resent, { ok: false, message: NO_ACCESS_MESSAGE });

    const rejected = await rejectDocument(DOC, "Expired certificate");
    assert.deepEqual(rejected, { ok: false, error: NO_ACCESS_MESSAGE });
    assert.equal(s.tables.contractor_documents[0].status, "uploaded", "the document was not touched");

    const approved = await approveDocument(DOC, "2030-01-01");
    assert.deepEqual(approved, { ok: false, error: NO_ACCESS_MESSAGE });

    assert.equal(s.sent.length, 0, "no email may go out for a company without an active plan");
    assert.equal((s.tables.email_send_log ?? []).length, 0, "nothing was charged to the cap either");
  });
}

test("no session: the gate refuses before reading anything", async () => {
  const s = seed("active");
  s.company = null;
  const resent = await resendOnboardingRequest(K);
  assert.equal(resent.ok, false);
  assert.equal(s.sent.length, 0);
});

// ---------------------------------------------------------------------------
// Normal paid paths still work

for (const status of ["active", "trialing", "past_due"]) {
  test(`status '${status}': adding a contractor creates it and sends one onboarding email`, async () => {
    const s = seed(status);
    const created = await runCreate();
    assert.ok(created.redirectedTo, "a successful create redirects back to the list");
    const params = new URLSearchParams(created.redirectedTo!.split("?")[1]);
    assert.equal(params.get("created"), "Tiles R Us");
    assert.equal(params.get("email"), null, "no email warning on the happy path");

    const row = s.tables.contractors.find((c) => c.email === "terry@tiles.test");
    assert.ok(row, "the contractor exists");
    assert.equal(s.sent.length, 1);
    assert.equal(s.sent[0].to, "terry@tiles.test");
    const token = s.tables.contractor_tokens.find((t) => t.contractor_id === row!.id)!.token as string;
    assert.ok(String(s.sent[0].text).includes(`https://app.test/onboard/${token}`), "the email carries the new link");
    assert.equal(s.tables.email_send_log.length, 1, "the send was counted against the cap");
  });
}

test("paid: resend sends one email and extends the link", async () => {
  const s = seed("active");
  s.tables.contractor_tokens[0].expires_at = "2026-01-01T00:00:00Z";
  const resent = await resendOnboardingRequest(K);
  assert.equal(resent.ok, true, resent.message);
  assert.equal(s.sent.length, 1);
  assert.equal(s.sent[0].to, "sam@sparky.test");
  assert.ok(String(s.tables.contractor_tokens[0].expires_at) > "2026-01-01T00:00:00Z", "the link was extended");
});

test("paid: approving the last document sends one approval email", async () => {
  const s = seed("active");
  g.__nextContractorStatus = "approved";
  const approved = await approveDocument(DOC, "2030-01-01");
  assert.deepEqual(approved, { ok: true });
  assert.equal(s.tables.contractor_documents[0].status, "approved");
  assert.equal(s.sent.length, 1);
  assert.equal(s.sent[0].to, "sam@sparky.test");
});

test("paid: rejecting a document records it and emails the contractor once", async () => {
  const s = seed("active");
  const rejected = await rejectDocument(DOC, "Expired certificate");
  assert.deepEqual(rejected, { ok: true, emailWarning: undefined });
  assert.equal(s.tables.contractor_documents[0].status, "rejected");
  assert.equal(s.sent.length, 1);
});

// ---------------------------------------------------------------------------
// Cooldown

test("cooldown: two resends inside 5 minutes send once; after the window, again", async () => {
  const s = seed("active");
  let clock = Date.parse("2026-11-10T00:00:00Z");
  s.now = () => clock;

  const first = await resendOnboardingRequest(K);
  const second = await resendOnboardingRequest(K);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.match(second.message, /wait|minute|second/i);
  assert.equal(s.sent.length, 1, "the second click within the cooldown sent nothing");

  // A different contractor isn't affected by K's cooldown.
  assert.equal((await resendOnboardingRequest(K2)).ok, true);
  assert.equal(s.sent.length, 2);

  clock += (RESEND_COOLDOWN_SECONDS + 1) * 1000;
  assert.equal((await resendOnboardingRequest(K)).ok, true, "allowed again once the window has passed");
  assert.equal(s.sent.length, 3);
});

test("cooldown: the stamp lives in the server-only table, not on the token row", async () => {
  const s = seed("active");
  await resendOnboardingRequest(K);
  assert.equal(s.tables.contractor_request_cooldowns.length, 1);
  assert.equal(s.tables.contractor_tokens[0].last_request_sent_at, undefined);
});

test("cooldown: a send that hits the daily cap hands the cooldown slot back", async () => {
  const s = seed("active");
  fillCap(A);
  const blocked = await resendOnboardingRequest(K);
  assert.deepEqual(blocked, { ok: false, message: DAILY_LIMIT_MESSAGE });
  assert.equal((s.tables.contractor_request_cooldowns ?? []).length, 0, "no cooldown left behind");
});

// ---------------------------------------------------------------------------
// Daily cap

test(`cap: ${COMPANY_DAILY_EMAIL_CAP} sends in 24h go out, the next is refused before Resend is called`, async () => {
  const s = seed("active");
  const payload = { from: "x@test", to: "c@test", subject: "s", text: "t" };
  for (let i = 0; i < COMPANY_DAILY_EMAIL_CAP; i++) {
    const r = await sendCappedEmail(A, "request", payload);
    assert.equal(r.ok, true, `send ${i + 1} should go out`);
  }
  assert.equal(s.sent.length, 200);

  const over = await sendCappedEmail(A, "request", payload);
  assert.deepEqual(over, { ok: false, reason: "daily_limit" });
  assert.equal(s.sent.length, 200, "the 201st never reached Resend");

  // Another company has its own allowance.
  assert.equal((await sendCappedEmail(B, "request", payload)).ok, true);
});

test("cap: sends older than the window stop counting", async () => {
  const s = seed("active");
  let clock = Date.parse("2026-11-10T00:00:00Z");
  s.now = () => clock;
  fillCap(A);
  assert.deepEqual(await sendCappedEmail(A, "approved", { from: "x", to: "c", subject: "s", text: "t" }), {
    ok: false,
    reason: "daily_limit",
  });
  clock += COMPANY_EMAIL_WINDOW_SECONDS * 1000 + 1000;
  assert.equal((await sendCappedEmail(A, "approved", { from: "x", to: "c", subject: "s", text: "t" })).ok, true);
});

test("cap: rejectDocument at the cap still records the rejection but sends nothing", async () => {
  const s = seed("active");
  fillCap(A);
  const rejected = await rejectDocument(DOC, "Wrong policy");
  assert.equal(rejected.ok, true);
  assert.ok(rejected.emailWarning?.includes(DAILY_LIMIT_MESSAGE), rejected.emailWarning);
  assert.equal(s.tables.contractor_documents[0].status, "rejected");
  assert.equal(s.sent.length, 0);
});

test("cap: adding a contractor at the cap creates it and flags the unsent email", async () => {
  const s = seed("active");
  fillCap(A);
  const created = await runCreate();
  const params = new URLSearchParams(created.redirectedTo!.split("?")[1]);
  assert.equal(params.get("email"), "daily_limit");
  assert.equal(s.sent.length, 0);
});

test("cap: a broken counter fails open (logged) rather than blocking a legitimate send", async () => {
  const s = seed("active");
  s.rpcErrors.claim_email_send = "connection reset";
  const originalError = console.error;
  console.error = () => {};
  try {
    const resent = await resendOnboardingRequest(K);
    assert.equal(resent.ok, true);
  } finally {
    console.error = originalError;
  }
  assert.equal(s.sent.length, 1);
});
