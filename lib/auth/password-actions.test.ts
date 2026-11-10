/**
 * L2: the password rule is enforced on the server, not only in the browser.
 * Runs the real setPassword action with Supabase's updateUser recorded.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { installServerModuleStubs } from "../test-support/server-module-stubs.ts";

const calls: string[] = [];
(globalThis as Record<string, unknown>).__pwCalls = calls;

installServerModuleStubs({
  "@/lib/supabase/server": `export async function createClient(){ return { auth: { updateUser: async ({ password }) => { globalThis.__pwCalls.push(password); return { error: null }; } } }; }`,
});

const { saveNewPassword: setPassword } = await import("./password-actions.ts");

test("L2: a 9-character password is refused before Supabase is called", async () => {
  calls.length = 0;
  const r = await setPassword("abcd12345");
  assert.equal(r.ok, false);
  assert.match((r as { error: string }).error, /10 characters/);
  assert.deepEqual(calls, []);
});

test("L2: common and repeated passwords are refused on the server", async () => {
  calls.length = 0;
  assert.equal((await setPassword("password123")).ok, false);
  assert.equal((await setPassword("aaaaaaaaaaaa")).ok, false);
  assert.equal((await setPassword(undefined)).ok, false);
  assert.deepEqual(calls, []);
});

test("L2 normal path: a 10-character password is set", async () => {
  calls.length = 0;
  assert.deepEqual(await setPassword("tradie-2026"), { ok: true });
  assert.deepEqual(calls, ["tradie-2026"]);
});
