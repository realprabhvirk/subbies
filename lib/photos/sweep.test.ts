import test from "node:test";
import assert from "node:assert/strict";

import { sweepOrphanPhotos } from "./sweep.ts";
import type { StorageListEntry } from "../storage-cleanup-logic.ts";

const NOW = Date.parse("2026-11-11T12:00:00Z");
const ago = (mins: number) => new Date(NOW - mins * 60_000).toISOString();

// company/project/files
const tree: Record<string, StorageListEntry[]> = {
  "": [{ name: "co1", id: null }],
  co1: [{ name: "p1", id: null }],
  "co1/p1": [
    { name: "keep.webp", id: "1", created_at: ago(600) },
    { name: "keep-thumb.webp", id: "2", created_at: ago(600) },
    { name: "orphan.webp", id: "3", created_at: ago(120) },
    { name: "orphan-thumb.webp", id: "4", created_at: ago(120) },
    { name: "inflight.webp", id: "5", created_at: ago(10) },
  ],
};
const lister = { list: async (prefix: string) => ({ data: tree[prefix] ?? [], error: null }) };

test("removes only unregistered files older than an hour", async () => {
  const removed: string[] = [];
  const r = await sweepOrphanPhotos({
    lister,
    registeredPaths: async () => ["co1/p1/keep.webp", "co1/p1/keep-thumb.webp"],
    remove: async (paths) => { removed.push(...paths); return { error: null }; },
    nowMs: NOW,
  });
  assert.deepEqual(removed.sort(), ["co1/p1/orphan-thumb.webp", "co1/p1/orphan.webp"]);
  assert.deepEqual(r, { removed: 2, failed: 0, skipped: false });
});

test("deletes nothing when the database read fails", async () => {
  let called = false;
  const r = await sweepOrphanPhotos({
    lister,
    registeredPaths: async () => null,
    remove: async () => { called = true; return { error: null }; },
    nowMs: NOW,
  });
  assert.equal(called, false);
  assert.equal(r.skipped, true);
});

test("deletes nothing when the listing throws", async () => {
  let called = false;
  const r = await sweepOrphanPhotos({
    lister: { list: async () => { throw new Error("down"); } },
    registeredPaths: async () => [],
    remove: async () => { called = true; return { error: null }; },
    nowMs: NOW,
  });
  assert.equal(called, false);
  assert.equal(r.skipped, true);
});
