/**
 * L6: every cron and health route checks CRON_SECRET with the constant-time
 * helper, not a plain string compare. Scans the route sources, then runs one
 * route for real to show a wrong or missing secret gets 401 and the right one
 * gets through.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { installServerModuleStubs } from "../test-support/server-module-stubs.ts";
import { resetFake, fakeModuleSource } from "../test-support/fake-supabase.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

test("L6: every route that reads Authorization uses hasCronSecret, none compares strings", () => {
  const files = [...routeFiles(path.join(ROOT, "app/api/cron")), ...routeFiles(path.join(ROOT, "app/api/health"))];
  assert.ok(files.length >= 5, `expected the cron and health routes, found ${files.length}`);
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    assert.ok(src.includes("hasCronSecret(req.headers.get(\"authorization\"))"), `${rel} must use hasCronSecret`);
    assert.ok(!/get\("authorization"\)\s*[!=]==/.test(src), `${rel} still compares the header with ===`);
    assert.ok(!/[!=]==\s*`Bearer/.test(src), `${rel} still compares against a Bearer string`);
  }
});

installServerModuleStubs({
  "server-only": ``,
  "@/lib/supabase/admin": fakeModuleSource(`export function createAdminClient(){ return F.makeClient(); }`),
});
process.env.CRON_SECRET = "cron-test-placeholder";
const { GET } = await import("../../app/api/health/uploads/route.ts");

const call = (auth?: string) =>
  GET(new Request("https://app.test/api/health/uploads", { headers: auth ? { authorization: auth } : {} }) as never);

test("L6: the health route refuses a missing, wrong or near-miss secret", async () => {
  resetFake();
  for (const auth of [undefined, "Bearer nope", "Bearer cron-test-placeholde", "cron-test-placeholder", "Bearer cron-test-placeholderX"]) {
    assert.equal((await call(auth)).status, 401, String(auth));
  }
});

test("L6 normal path: the right secret gets through", async () => {
  resetFake();
  const log = console.log, err = console.error;
  console.log = () => {}; console.error = () => {};
  try {
    assert.notEqual((await call("Bearer cron-test-placeholder")).status, 401);
  } finally {
    console.log = log; console.error = err;
  }
});

test("L6: with CRON_SECRET unset, nothing gets through", async () => {
  const saved = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    assert.equal((await call("Bearer ")).status, 401);
    assert.equal((await call("Bearer undefined")).status, 401);
  } finally {
    process.env.CRON_SECRET = saved;
  }
});
