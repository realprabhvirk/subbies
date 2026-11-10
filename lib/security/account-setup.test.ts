/**
 * L3: completeAccountSetup is idempotent. With companies.user_id unique
 * (migration 0020), two simultaneous submits create one company and both
 * report success.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { installServerModuleStubs } from "../test-support/server-module-stubs.ts";

const state = { companies: [] as { user_id: string; name: string }[], existing: null as unknown };
(globalThis as Record<string, unknown>).__setup = state;

installServerModuleStubs({
  "server-only": ``,
  "next/cache": `export function revalidatePath(){}`,
  // Mirrors the unique index: a second row for the same user is a 23505.
  "@/lib/supabase/server": `export async function createClient(){ return { from: () => ({ insert: async (row) => {
    const st = globalThis.__setup;
    await new Promise((r) => setTimeout(r, 1));
    if (row.name === "Boom") return { error: { code: "XX000", message: "connection reset" } };
    if (st.companies.some((c) => c.user_id === row.user_id)) return { error: { code: "23505", message: "duplicate key value violates unique constraint companies_user_id_key" } };
    st.companies.push(row); return { error: null };
  } }) }; }`,
  "@/lib/supabase/dal": `
    export async function requireUser(){ return { id: "u1", email: "owner@acme.test" }; }
    export async function getCompany(){ return globalThis.__setup.existing; }
  `,
  "@/lib/billing/require-active": `export async function requireActiveCompany(){ return { ok: false, error: "n/a" }; }`,
});

const { completeAccountSetup } = await import("../../app/dashboard/actions.ts");

const form = (name: string) => { const f = new FormData(); f.set("name", name); return f; };

test("L3: two simultaneous submits create one company and both succeed", async () => {
  state.companies = [];
  state.existing = null;
  const [a, b] = await Promise.all([completeAccountSetup(null, form("Acme")), completeAccountSetup(null, form("Acme"))]);
  assert.deepEqual(a, { ok: true });
  assert.deepEqual(b, { ok: true });
  assert.equal(state.companies.length, 1);
});

test("L3 normal path: an account that already has a company inserts nothing", async () => {
  state.companies = [];
  state.existing = { id: "c1", name: "Acme" };
  assert.deepEqual(await completeAccountSetup(null, form("Acme")), { ok: true });
  assert.equal(state.companies.length, 0);
});

test("L3: other insert errors are still reported", async () => {
  state.existing = null;
  state.companies = [{ user_id: "other", name: "x" }];
  const err = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await completeAccountSetup(null, form("Boom")), { ok: false, error: "Couldn't finish setup. Try again in a moment." });
  } finally {
    console.error = err;
  }
});
