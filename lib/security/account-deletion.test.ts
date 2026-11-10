/**
 * L7: account deletion removes the auth user BEFORE wiping stored files, so
 * a failed delete leaves the account and its documents intact. Runs the real
 * confirmAccountDeletion; Stripe, the code check and storage are stubbed and
 * record the order things happen in.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { installServerModuleStubs } from "../test-support/server-module-stubs.ts";
import { resetFake, fakeModuleSource } from "../test-support/fake-supabase.ts";

const st = { events: [] as string[], deleteUserFails: false, wipeFails: false };
(globalThis as Record<string, unknown>).__del = st;

installServerModuleStubs({
  "server-only": ``,
  "@/lib/supabase/dal": `
    export async function requireUser(){ return { id: "u1", email: "Owner@Acme.test" }; }
    export async function getCompany(){ return { id: "c1", name: "Acme" }; }
  `,
  "@/lib/supabase/admin": fakeModuleSource(`
    export function createAdminClient(){
      const client = F.makeClient();
      client.auth = { admin: { deleteUser: async () => {
        globalThis.__del.events.push("deleteUser");
        return { error: globalThis.__del.deleteUserFails ? { message: "auth down" } : null };
      } } };
      return client;
    }
  `),
  "@/lib/billing/stripe": `export function getStripe(){ return { subscriptions: { cancel: async () => { globalThis.__del.events.push("stripeCancel"); } } }; }`,
  "@/lib/billing/entitlements": `export async function getEntitlement(){ return { stripeSubscriptionId: "sub_1" }; }`,
  "@/lib/billing/trial-eligibility": `
    export async function isTrialLedgerReachable(){ return true; }
    export async function recordUsedTrial(){ globalThis.__del.events.push("ledger"); }
  `,
  "@/lib/storage": `export async function deleteAllCompanyDocuments(){
    globalThis.__del.events.push("wipe");
    return { deletedCount: 3, failedPaths: globalThis.__del.wipeFails ? ["c1/k/d/x.pdf"] : [] };
  }`,
  "@/lib/auth/deletion-codes": `
    export async function requestDeletionCode(){ return { ok: true, code: "000000" }; }
    export async function verifyDeletionCode(){ return { ok: true }; }
  `,
  "@/lib/email/account-deletion": `export async function sendAccountDeletionCodeEmail(){ return { ok: true }; }`,
});

const { confirmAccountDeletion } = await import("../../app/dashboard/settings/deletion-actions.ts");

function reset() {
  const s = resetFake();
  s.tables.used_trial_emails = [{ email: "owner@acme.test" }];
  st.events = [];
  st.deleteUserFails = false;
  st.wipeFails = false;
  return s;
}

const quiet = async <T>(fn: () => Promise<T>) => {
  const e = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = e; }
};

test("L7 normal path: cancel billing, record the ledger, delete the user, THEN wipe files", async () => {
  reset();
  assert.deepEqual(await confirmAccountDeletion("123456", true), { ok: true });
  assert.deepEqual(st.events, ["stripeCancel", "ledger", "deleteUser", "wipe"]);
});

test("L7: if deleting the auth user fails, no files are wiped and the ledger is rolled back", async () => {
  const s = reset();
  st.deleteUserFails = true;
  const r = await quiet(() => confirmAccountDeletion("123456", true));
  assert.equal(r.ok, false);
  assert.ok(!r.error?.includes("—"), "no em dash in the message");
  assert.ok(!st.events.includes("wipe"), "the files of a still-existing account are untouched");
  assert.deepEqual(s.tables.used_trial_emails, [], "ledger entry undone");
});

test("L7: a partial file wipe after the user is gone still reports success (and is logged)", async () => {
  reset();
  st.wipeFails = true;
  const logged: unknown[] = [];
  const e = console.error;
  console.error = (...a: unknown[]) => { logged.push(a); };
  try {
    assert.deepEqual(await confirmAccountDeletion("123456", true), { ok: true });
  } finally {
    console.error = e;
  }
  assert.equal(logged.length, 1);
  assert.ok(!JSON.stringify(logged).includes("x.pdf"), "paths aren't logged, only counts");
});
