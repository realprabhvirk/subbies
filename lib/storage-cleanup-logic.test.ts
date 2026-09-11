import test from "node:test";
import assert from "node:assert/strict";

import {
  collectAllPaths,
  batchPaths,
  type StorageLister,
  type StorageListEntry,
} from "./storage-cleanup-logic.ts";

/**
 * An in-memory fake of Supabase Storage's `list()`, keyed by prefix, so the
 * recursion can be tested without a real bucket or a service-role key.
 * Entries with `id: null` are folders (Storage's own convention — see
 * storage-cleanup-logic.ts); everything else is a file.
 */
function fakeLister(tree: Record<string, StorageListEntry[]>): StorageLister {
  return {
    list: async (prefix) => ({ data: tree[prefix] ?? [], error: null }),
  };
}

test("empty prefix (a company with no documents at all) collects nothing", async () => {
  const lister = fakeLister({ "company-1": [] });
  assert.deepEqual(await collectAllPaths(lister, "company-1"), []);
});

test("walks the real three-level shape: company/contractor/document/file", async () => {
  // Mirrors buildDocumentPath() in lib/storage.ts exactly.
  const lister = fakeLister({
    "company-1": [{ name: "contractor-a", id: null }],
    "company-1/contractor-a": [{ name: "doc-1", id: null }],
    "company-1/contractor-a/doc-1": [{ name: "file.pdf", id: "obj-1" }],
  });
  assert.deepEqual(await collectAllPaths(lister, "company-1"), [
    "company-1/contractor-a/doc-1/file.pdf",
  ]);
});

test("collects every file across multiple contractors and documents", async () => {
  const lister = fakeLister({
    "company-1": [
      { name: "contractor-a", id: null },
      { name: "contractor-b", id: null },
    ],
    "company-1/contractor-a": [{ name: "doc-1", id: null }],
    "company-1/contractor-a/doc-1": [{ name: "insurance.pdf", id: "obj-1" }],
    "company-1/contractor-b": [
      { name: "doc-2", id: null },
      { name: "doc-3", id: null },
    ],
    "company-1/contractor-b/doc-2": [{ name: "licence.jpg", id: "obj-2" }],
    "company-1/contractor-b/doc-3": [{ name: "workers-comp.pdf", id: "obj-3" }],
  });
  const paths = await collectAllPaths(lister, "company-1");
  assert.deepEqual(new Set(paths), new Set([
    "company-1/contractor-a/doc-1/insurance.pdf",
    "company-1/contractor-b/doc-2/licence.jpg",
    "company-1/contractor-b/doc-3/workers-comp.pdf",
  ]));
});

test("catches an orphaned file with no matching database row", async () => {
  // A crashed upload confirm step (never wrote file_url) shouldn't be
  // invisible to deletion just because no DB row points at it — this is
  // exactly why deletion walks the real bucket instead of trusting
  // contractor_documents.file_url.
  const lister = fakeLister({
    "company-1": [{ name: "contractor-a", id: null }],
    "company-1/contractor-a": [{ name: "doc-1", id: null }],
    "company-1/contractor-a/doc-1": [
      { name: "confirmed.pdf", id: "obj-1" },
      { name: "orphaned-upload.pdf", id: "obj-2" },
    ],
  });
  const paths = await collectAllPaths(lister, "company-1");
  assert.ok(paths.includes("company-1/contractor-a/doc-1/orphaned-upload.pdf"));
  assert.equal(paths.length, 2);
});

test("a listing error at any level yields no paths from that branch, not a crash", async () => {
  const lister: StorageLister = {
    list: async (prefix) => {
      if (prefix === "company-1/contractor-a") {
        return { data: null, error: new Error("boom") };
      }
      return { data: [{ name: "contractor-a", id: null }], error: null };
    },
  };
  assert.deepEqual(await collectAllPaths(lister, "company-1"), []);
});

test("batchPaths splits into fixed-size chunks and preserves order", () => {
  const paths = ["a", "b", "c", "d", "e"];
  assert.deepEqual(batchPaths(paths, 2), [["a", "b"], ["c", "d"], ["e"]]);
});

test("batchPaths with a batch size larger than the input returns one batch", () => {
  assert.deepEqual(batchPaths(["a", "b"], 100), [["a", "b"]]);
});

test("batchPaths on an empty list returns no batches", () => {
  assert.deepEqual(batchPaths([], 100), []);
});
