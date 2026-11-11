import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

import { checkUpload, processPhoto, sniffImageType, MAX_UPLOAD_BYTES } from "./process.ts";

async function jpegWithGps(width = 3000, height = 2000): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 30, g: 58, b: 95 } } })
    .jpeg()
    .withExif({
      IFD0: { Make: "TestPhone", Model: "Site Cam" },
      IFD3: { GPSLatitudeRef: "S", GPSLatitude: "28/1 5/1 20/1", GPSLongitudeRef: "E", GPSLongitude: "153/1 27/1 4/1" },
    })
    .toBuffer();
}

test("fixture really carries GPS before processing", async () => {
  const meta = await sharp(await jpegWithGps(200, 100)).metadata();
  assert.ok(meta.exif && meta.exif.length > 0);
  assert.match(meta.exif!.toString("latin1"), /GPS|TestPhone/);
});

test("processing strips EXIF including GPS from the full image and the thumbnail", async () => {
  const out = await processPhoto(await jpegWithGps());
  for (const buf of [out.full, out.thumb]) {
    const meta = await sharp(buf).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.exif, undefined, "no EXIF block at all");
    assert.equal(meta.xmp, undefined);
    assert.equal(meta.iptc, undefined);
    assert.doesNotMatch(buf.toString("latin1"), /TestPhone|GPS/);
  }
});

test("orientation is baked in (EXIF 6 = rotate 90), long edge capped at 1600, thumbnail 480", async () => {
  const rotated = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#123" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  assert.equal((await sharp(rotated).metadata()).orientation, 6);
  const out = await processPhoto(rotated);
  // 3000x2000 rotated 90 degrees is 2000x3000, then fitted inside 1600.
  assert.equal(out.height, 1600);
  assert.ok(out.width < out.height);
  const t = await sharp(out.thumb).metadata();
  assert.equal(t.width, 480);
  assert.equal(t.height, 480);
});

test("small images aren't enlarged", async () => {
  const small = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#fff" } }).png().toBuffer();
  const out = await processPhoto(small);
  assert.equal(out.width, 800);
});

test("magic bytes decide the type, not the name", async () => {
  assert.equal(sniffImageType(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).jpeg().toBuffer()), "jpeg");
  assert.equal(sniffImageType(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).png().toBuffer()), "png");
  assert.equal(sniffImageType(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).webp().toBuffer()), "webp");
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(16)]);
  assert.equal(sniffImageType(heic), "heic");
  assert.equal(sniffImageType(Buffer.from("%PDF-1.7 not an image at all")), null);
  assert.equal(sniffImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")), null);
});

test("checkUpload: HEIC, non-images, empty and oversized files are refused with plain words", () => {
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypmif1"), Buffer.alloc(16)]);
  assert.deepEqual(checkUpload(heic), { ok: false, error: "Please choose a JPEG, PNG or WebP photo." });
  assert.equal(checkUpload(Buffer.from("GIF89a............")).ok, false);
  assert.deepEqual(checkUpload(Buffer.alloc(0)), { ok: false, error: "That file is empty." });
  const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
  big.set([0xff, 0xd8, 0xff]);
  assert.match((checkUpload(big) as { error: string }).error, /under 4 MB/);
});

test("a file with image magic bytes that won't decode throws (route returns a clean error)", async () => {
  const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
  await assert.rejects(processPhoto(fake));
});
