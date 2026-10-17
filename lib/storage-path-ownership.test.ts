import test from "node:test";
import assert from "node:assert/strict";

import {
  isPathOwnedByCompany,
  isValidCompanyId,
  partitionOwnedPaths,
} from "./storage-path-ownership.ts";

const A = "2f7fc5a6-badc-46a4-8b27-afd25746ea8c";
const B = "34c4652e-ae33-4973-82e5-53d8b1ed7a20";
const K = "3c570c69-34b9-49be-bbdb-dce0e6424dbd";
const D = "dccdcb9d-42b2-4f57-80f9-884e3ffba4e0";
const own = `${A}/${K}/${D}/23f68c40-2670-43c0-9a62-024fef3c9cca.pdf`;

test("a path inside the company's own folder is accepted", () => {
  assert.equal(isPathOwnedByCompany(own, A), true);
  assert.equal(isPathOwnedByCompany(`${A}/${K}/${D}/x.png`, A), true);
});

test("another company's path is refused (the C1 attack)", () => {
  assert.equal(isPathOwnedByCompany(own, B), false);
});

test("a company id that is only a prefix of the first segment is refused", () => {
  // e.g. a crafted folder named "<companyId>-evil" must not count as the company
  assert.equal(isPathOwnedByCompany(`${A}-evil/${K}/x.pdf`, A), false);
  assert.equal(isPathOwnedByCompany(`${A}x/${K}/x.pdf`, A), false);
});

test("the bare company folder or an empty remainder is refused", () => {
  assert.equal(isPathOwnedByCompany(A, A), false);
  assert.equal(isPathOwnedByCompany(`${A}/`, A), false);
});

test("traversal segments are refused", () => {
  assert.equal(isPathOwnedByCompany(`${A}/../${B}/${K}/x.pdf`, A), false);
  assert.equal(isPathOwnedByCompany(`${A}/${K}/../../${B}/x.pdf`, A), false);
  assert.equal(isPathOwnedByCompany(`${A}/./${K}/x.pdf`, A), false);
  assert.equal(isPathOwnedByCompany(`${A}//${K}/x.pdf`, A), false);
});

test("absolute paths, backslashes and URL-encoding are refused", () => {
  assert.equal(isPathOwnedByCompany(`/${own}`, A), false);
  assert.equal(isPathOwnedByCompany(`${A}\\..\\${B}\\x.pdf`, A), false);
  assert.equal(isPathOwnedByCompany(`${A}/%2e%2e/${B}/x.pdf`, A), false);
  assert.equal(isPathOwnedByCompany(`${A}%2F..%2F${B}/x.pdf`, A), false);
});

test("control characters are refused", () => {
  assert.equal(isPathOwnedByCompany(`${A}/${K}/x\u0000.pdf`, A), false);
  assert.equal(isPathOwnedByCompany(`${A}/${K}/x\n.pdf`, A), false);
});

test("empty or non-string inputs are refused", () => {
  assert.equal(isPathOwnedByCompany("", A), false);
  assert.equal(isPathOwnedByCompany(null, A), false);
  assert.equal(isPathOwnedByCompany(undefined, A), false);
  assert.equal(isPathOwnedByCompany(own, ""), false);
  assert.equal(isPathOwnedByCompany(own, null), false);
});

test("a company id that isn't a UUID is refused, so a wildcard can't match", () => {
  assert.equal(isPathOwnedByCompany(own, "*"), false);
  assert.equal(isPathOwnedByCompany("x/y.pdf", "x"), false);
});

test("a very long path is refused", () => {
  assert.equal(isPathOwnedByCompany(`${A}/${"a".repeat(1100)}.pdf`, A), false);
});

test("partitionOwnedPaths keeps own paths and separates foreign ones", () => {
  const foreign = `${B}/${K}/${D}/y.pdf`;
  const { owned, refused } = partitionOwnedPaths([own, foreign, "", null, `${A}/../x`], A);
  assert.deepEqual(owned, [own]);
  assert.deepEqual(refused, [foreign, `${A}/../x`]);
});

test("isValidCompanyId accepts only a UUID", () => {
  assert.equal(isValidCompanyId(A), true);
  assert.equal(isValidCompanyId(""), false);
  assert.equal(isValidCompanyId("/"), false);
  assert.equal(isValidCompanyId(undefined), false);
});
