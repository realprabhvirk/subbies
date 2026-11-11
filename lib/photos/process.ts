/**
 * Jobsite photo processing (D3). Every upload is decoded and re-encoded on
 * the server, so nothing the client sent is stored as-is:
 *
 * - the type is decided from the file's first bytes, never its name or the
 *   browser's MIME claim;
 * - rotate() bakes in the EXIF orientation, and sharp drops all metadata on
 *   output by default, so EXIF, including GPS (jobsite photos routinely
 *   carry the site's coordinates and often the photographer's), never
 *   reaches storage;
 * - the full image is capped at 1600px on its long edge and a 480px
 *   thumbnail is made, both WebP.
 *
 * Pure apart from sharp, so it runs under plain `node --test`.
 */
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const FULL_EDGE = 1600;
export const THUMB_EDGE = 480;

export type SniffedType = "jpeg" | "png" | "webp" | "heic" | null;

/** What the bytes say the file is. */
export function sniffImageType(buf: Uint8Array): SniffedType {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return "png";
  const ascii = (from: number, to: number) => String.fromCharCode(...buf.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|heif)$/.test(ascii(8, 12))) return "heic";
  return null;
}

export type PhotoCheck =
  | { ok: true; type: "jpeg" | "png" | "webp" }
  | { ok: false; error: string };

export function checkUpload(buf: Uint8Array): PhotoCheck {
  if (buf.length === 0) return { ok: false, error: "That file is empty." };
  if (buf.length > MAX_UPLOAD_BYTES) return { ok: false, error: "That photo is too large. Choose one under 4 MB." };
  const type = sniffImageType(buf);
  if (type === "heic") return { ok: false, error: "Please choose a JPEG, PNG or WebP photo." };
  if (!type) return { ok: false, error: "Please choose a JPEG, PNG or WebP photo." };
  return { ok: true, type };
}

export interface ProcessedPhoto {
  full: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
}

/** Decode, auto-orient, strip metadata, resize, re-encode. Throws on an undecodable file. */
export async function processPhoto(buf: Uint8Array): Promise<ProcessedPhoto> {
  // limitInputPixels guards against decompression bombs (a tiny file that
  // decodes to a gigantic bitmap). 40 MP covers any phone camera.
  const base = sharp(buf, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  const { data: full, info } = await base
    .clone()
    .resize({ width: FULL_EDGE, height: FULL_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await base
    .clone()
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "cover", position: "attention" })
    .webp({ quality: 78 })
    .toBuffer();
  return { full, thumb, width: info.width, height: info.height };
}
