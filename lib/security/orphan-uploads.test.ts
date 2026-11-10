/**
 * M1: the orphan upload sweep. Runs the real route handler with Storage and
 * Supabase faked. Checks the secret gate, that it only reports by default,
 * and that ?dry=0 deletes only files that are both unregistered and older
 * than 24 hours.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { installServerModuleStubs } from "../test-support/server-module-stubs.ts";
import { resetFake, fakeModuleSource } from "../test-support/fake-supabase.ts";

type Obj = { path: string; createdAt: string | null };
const storage = { objects: [] as Obj[], deleted: [] as string[] };
(globalThis as Record<string, unknown>).__storage = storage;

installServerModuleStubs({
  "server-only": ``,
  "@/lib/supabase/admin": fakeModuleSource(`export function createAdminClient(){ return F.makeClient(); }`),
  "@/lib/storage": `
    export async function listAllDocumentObjects(){ return globalThis.__storage.objects; }
    export async function deleteObjects(paths){ globalThis.__storage.deleted.push(...paths); return { deletedCount: paths.length, failedPaths: [] }; }
  `,
});

process.env.CRON_SECRET = "test-cron-placeholder";
const { GET } = await import("../../app/api/cron/orphan-uploads/route.ts");

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

function seed() {
  const s = resetFake();
  s.tables.contractor_document_files = [{ file_path: "c/k/d/registered.pdf" }];
  s.tables.contractor_documents = [{ file_url: "c/k/d/legacy.pdf" }, { file_url: null }];
  storage.objects = [
    { path: "c/k/d/registered.pdf", createdAt: hoursAgo(72) },
    { path: "c/k/d/legacy.pdf", createdAt: hoursAgo(72) },
    { path: "c/k/d/orphan-old.pdf", createdAt: hoursAgo(25) },
    { path: "c/k/d/orphan-recent.pdf", createdAt: hoursAgo(2) },
    { path: "c/k/d/no-time.pdf", createdAt: null },
  ];
  storage.deleted = [];
}

const call = (query = "", auth: string | null = "Bearer test-cron-placeholder") =>
  GET(new Request(`https://app.test/api/cron/orphan-uploads${query}`, {
    headers: auth ? { authorization: auth } : {},
  }) as never);

const quietLog = async <T>(fn: () => Promise<T>) => {
  const log = console.log;
  console.log = () => {};
  try { return await fn(); } finally { console.log = log; }
};

test("orphan sweep: refused without the right secret", async () => {
  seed();
  assert.equal((await call("", null)).status, 401);
  assert.equal((await call("", "Bearer wrong")).status, 401);
  assert.equal((await call("", "test-cron-placeholder")).status, 401);
  assert.equal(storage.deleted.length, 0);
});

test("orphan sweep: reports only by default", async () => {
  seed();
  const res = await quietLog(() => call());
  const body = await res.json();
  assert.equal(body.dry, true);
  assert.equal(body.scanned, 5);
  assert.equal(body.orphans, 1);
  assert.equal(body.deleted, 0);
  assert.equal(storage.deleted.length, 0);
  assert.ok(!JSON.stringify(body).includes("c/k/d"), "never returns paths");
});

test("orphan sweep: ?dry=0 deletes only unregistered files older than 24h", async () => {
  seed();
  const body = await (await quietLog(() => call("?dry=0"))).json();
  assert.equal(body.deleted, 1);
  assert.deepEqual(storage.deleted, ["c/k/d/orphan-old.pdf"]);
});
