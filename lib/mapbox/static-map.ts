/**
 * Mapbox Static Images URLs and token checks (D1). Pure; no network.
 *
 * The overview map is a plain <img> from the Static Images API with the
 * public, URL-restricted token: no map JavaScript on the page, browser
 * caching for free, and static-image pricing rather than map-load pricing.
 * The image is never stored or proxied by Subbies.
 */
export const BRAND_PIN = "1e3a5f";

/** A usable public token (pk.*), or null so the UI shows "Map unavailable". */
export function publicMapboxToken(raw: string | undefined = process.env.NEXT_PUBLIC_MAPBOX_TOKEN): string | null {
  const t = raw?.trim();
  return t && /^pk\.[A-Za-z0-9._-]{20,}$/.test(t) ? t : null;
}

export function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" && typeof lng === "number" &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}

export function staticMapUrl(opts: {
  lat: number;
  lng: number;
  token: string;
  width?: number;
  height?: number;
  zoom?: number;
}): string {
  const w = Math.min(Math.max(Math.round(opts.width ?? 640), 1), 1280);
  const h = Math.min(Math.max(Math.round(opts.height ?? 360), 1), 1280);
  const zoom = opts.zoom ?? 15;
  const lng = opts.lng.toFixed(6);
  const lat = opts.lat.toFixed(6);
  const pin = `pin-l+${BRAND_PIN}(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pin}/${lng},${lat},${zoom},0/${w}x${h}@2x?access_token=${encodeURIComponent(opts.token)}`;
}
