/**
 * M4: account deletion code attempts are counted atomically. Runs the real
 * verifyDeletionCode against the in-memory fake (whose RPC mirrors
 * consume_deletion_code_attempt). The SQL itself was also burst-tested in
 * parallel against Postgres; see supabase/tests/0020_security_audit_fixes.sql.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { installServerModuleStubs } from "../test-support/server-module-stubs.ts";
import { resetFake, fakeModuleSource } from "../test-support/fake-supabase.ts";

installServerModuleStubs({
  "server-only": ``,
  "@/lib/supabase/admin": fakeModuleSource(`export function createAdminClient(){ return F.makeClient(); }`),
});

const { verifyDeletionCode, MAX_ATTEMPTS, hashDeletionCode } = await import("../auth/deletion-codes.ts");

const USER = "00000000-0000-4000-8000-00000000000a";

function seed(code = "123456") {
  const s = resetFake();
  s.tables.account_deletion_codes = [{
    user_id: USER,
    code_hash: hashDeletionCode(code),
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    attempts: 0,
  }];
  return s;
}

test("M4: a burst of 50 parallel guesses uses exactly 5 attempts and checks at most 5", async () => {
  const s = seed();
  const results = await Promise.all(Array.from({ length: 50 }, (_, i) => verifyDeletionCode(USER, String(i).padStart(6, "9"))));
  assert.equal(s.tables.account_deletion_codes[0].attempts, MAX_ATTEMPTS);
  assert.equal(MAX_ATTEMPTS, 5);
  const checked = results.filter((r) => !r.ok && r.reason === "incorrect").length;
  const locked = results.filter((r) => !r.ok && r.reason === "too_many_attempts").length;
  assert.equal(checked, 5, "only 5 guesses were compared against the code");
  assert.equal(locked, 45);
});

test("M4: the right code inside a burst still can't beat the limit once it's used up", async () => {
  seed("424242");
  for (let i = 0; i < 5; i++) await verifyDeletionCode(USER, "000000");
  assert.deepEqual(await verifyDeletionCode(USER, "424242"), { ok: false, reason: "too_many_attempts" });
});

test("M4 normal path: the right code works and uses one attempt", async () => {
  const s = seed("424242");
  assert.deepEqual(await verifyDeletionCode(USER, "000001"), { ok: false, reason: "incorrect" });
  assert.deepEqual(await verifyDeletionCode(USER, "424242"), { ok: true });
  assert.equal(s.tables.account_deletion_codes[0].attempts, 2);
});

test("M4: no code on file reads as 'request a code', an expired one as expired", async () => {
  const s = seed();
  s.tables.account_deletion_codes = [];
  assert.deepEqual(await verifyDeletionCode(USER, "123456"), { ok: false, reason: "no_code" });
  seed();
  s.tables.account_deletion_codes[0].expires_at = new Date(Date.now() - 1000).toISOString();
  assert.deepEqual(await verifyDeletionCode(USER, "123456"), { ok: false, reason: "expired" });
});

test("M4: a database error fails closed", async () => {
  const s = seed();
  s.rpcErrors.consume_deletion_code_attempt = "boom";
  const err = console.error;
  console.error = () => {};
  try {
    assert.equal((await verifyDeletionCode(USER, "123456")).ok, false);
  } finally {
    console.error = err;
  }
});
