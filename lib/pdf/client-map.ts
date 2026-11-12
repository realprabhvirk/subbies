import { sniffImageType } from "../photos/process.ts";

/**
 * The report's map image as sent by the browser.
 *
 * Mapbox public tokens are URL-restricted, so they only work from the
 * browser (which sends the site's Referer). The "Download PDF" button
 * fetches the static map there and posts it with the report request. This
 * check is the gate: a real JPEG, PNG or WebP under the size cap, or
 * nothing. The renderer then re-encodes it with sharp (lib/pdf/render.ts),
 * so the bytes never reach the PDF as sent.
 */
export const MAX_CLIENT_MAP_BYTES = 1_500_000;

export function acceptClientMap(bytes: Uint8Array | null | undefined): Buffer | null {
  if (!bytes || bytes.length === 0 || bytes.length > MAX_CLIENT_MAP_BYTES) return null;
  const type = sniffImageType(bytes);
  if (type !== "jpeg" && type !== "png" && type !== "webp") return null;
  return Buffer.from(bytes);
}
