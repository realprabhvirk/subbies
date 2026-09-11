import test from "node:test";
import assert from "node:assert/strict";

import { groupFilesByDocument } from "./document-files-logic.ts";

test("empty input -> empty map", () => {
  const result = groupFilesByDocument([]);
  assert.equal(result.size, 0);
});

test("groups files under their document id, dropping the join key from the value", () => {
  const result = groupFilesByDocument([
    { id: "f1", file_name: "a.pdf", contractor_document_id: "doc1" },
    { id: "f2", file_name: "b.pdf", contractor_document_id: "doc1" },
    { id: "f3", file_name: "c.pdf", contractor_document_id: "doc2" },
  ]);

  assert.deepEqual(result.get("doc1"), [
    { id: "f1", fileName: "a.pdf" },
    { id: "f2", fileName: "b.pdf" },
  ]);
  assert.deepEqual(result.get("doc2"), [{ id: "f3", fileName: "c.pdf" }]);
  assert.equal(result.size, 2);
});

test("a document with no files simply has no entry (caller falls back to [])", () => {
  const result = groupFilesByDocument([
    { id: "f1", file_name: "a.pdf", contractor_document_id: "doc1" },
  ]);
  assert.equal(result.get("doc-with-nothing"), undefined);
});

test("preserves insertion order within a document's file list", () => {
  const result = groupFilesByDocument([
    { id: "f3", file_name: "third.pdf", contractor_document_id: "doc1" },
    { id: "f1", file_name: "first.pdf", contractor_document_id: "doc1" },
    { id: "f2", file_name: "second.pdf", contractor_document_id: "doc1" },
  ]);
  assert.deepEqual(
    result.get("doc1")?.map((f) => f.id),
    ["f3", "f1", "f2"],
  );
});

test("a null file_name is preserved as null, not coerced", () => {
  const result = groupFilesByDocument([
    { id: "f1", file_name: null, contractor_document_id: "doc1" },
  ]);
  assert.equal(result.get("doc1")?.[0].fileName, null);
});
