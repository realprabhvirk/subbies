import test from "node:test";
import assert from "node:assert/strict";

import { acceptClientMap, MAX_CLIENT_MAP_BYTES } from "./client-map.ts";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0]);
const WEBP = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");

test("accepts PNG, JPEG and WebP", () => {
  for (const img of [PNG, JPEG, WEBP]) {
    const out = acceptClientMap(img);
    assert.ok(Buffer.isBuffer(out));
    assert.equal(out!.length, img.length);
  }
});

test("refuses empty, missing, non-image and HEIC bytes", () => {
  assert.equal(acceptClientMap(null), null);
  assert.equal(acceptClientMap(undefined), null);
  assert.equal(acceptClientMap(new Uint8Array()), null);
  assert.equal(acceptClientMap(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), null);
  assert.equal(acceptClientMap(new TextEncoder().encode("%PDF-1.7 not an image")), null);
  assert.equal(acceptClientMap(new TextEncoder().encode("\u0000\u0000\u0000\u0018ftypheic0000")), null);
});

test("refuses anything over the size cap", () => {
  const big = new Uint8Array(MAX_CLIENT_MAP_BYTES + 1);
  big.set(PNG);
  assert.equal(acceptClientMap(big), null);
  const ok = new Uint8Array(MAX_CLIENT_MAP_BYTES);
  ok.set(PNG);
  assert.ok(acceptClientMap(ok));
});
