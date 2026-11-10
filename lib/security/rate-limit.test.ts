/**
 * L5: the rate limiter stores hashed keys, purges old rows, and still fails
 * open (logged) when the database is unavailable. Runs the real
 * lib/rate-limit.ts against the in-memory fake. Atomicity of
 * check_rate_limit itself is proven in SQL (parallel burst against Postgres).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { installServerModuleStubs } from "../test-support/server-module-stubs.ts";
import { resetFake, fakeModuleSource } from "../test-support/fake-supabase.ts";

installServerModuleStubs({
  "server-only": ``,
  "next/headers": `export async function headers(){ return new Map(); }`,
  "@/lib/supabase/admin": fakeModuleSource(`export function createAdminClient(){ return F.makeClient(); }`),
});

const { checkRateLimit, purgeRateLimitHits, RATE_LIMITS } = await import("../rate-limit.ts");
const { hashRateLimitKey } = await import("../rate-limit-key.ts");

const TOKEN = "11111111-1111-4111-8111-111111111111";

test("L5: the stored key is a hash, never the raw token or IP", async () => {
  const s = resetFake();
  assert.equal(await checkRateLimit(RATE_LIMITS.onboardAction, `upload:${TOKEN}`), true);
  const key = s.tables.rate_limit_hits[0].key as string;
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.ok(!key.includes(TOKEN));
  assert.equal(key, hashRateLimitKey("onboard_action", `upload:${TOKEN}`));
  assert.notEqual(hashRateLimitKey("contact", "1.2.3.4"), hashRateLimitKey("onboard_action", "1.2.3.4"));
});

test("L5 normal path: the same caller is still counted together and limited", async () => {
  resetFake();
  const rule = RATE_LIMITS.contact;
  for (let i = 0; i < rule.limit; i++) assert.equal(await checkRateLimit(rule, "1.2.3.4"), true);
  assert.equal(await checkRateLimit(rule, "1.2.3.4"), false);
  assert.equal(await checkRateLimit(rule, "5.6.7.8"), true, "a different caller is unaffected");
});

test("L5: an unavailable limiter fails open and logs", async () => {
  const s = resetFake();
  s.rpcErrors.check_rate_limit = "relation does not exist";
  const logged: unknown[] = [];
  const err = console.error;
  console.error = (...a: unknown[]) => { logged.push(a); };
  try {
    assert.equal(await checkRateLimit(RATE_LIMITS.contact, "1.2.3.4"), true);
  } finally {
    console.error = err;
  }
  assert.equal(logged.length, 1);
});

test("L5: the daily purge removes rows older than a day and keeps recent ones", async () => {
  const s = resetFake();
  const now = Date.now();
  s.tables.rate_limit_hits = [
    { bucket: "contact", key: "a", created_ms: now - 2 * 86_400_000 },
    { bucket: "contact", key: "b", created_ms: now - 60_000 },
  ];
  assert.equal(await purgeRateLimitHits(), 1);
  assert.deepEqual(s.tables.rate_limit_hits.map((r) => r.key), ["b"]);
});
