/**
 * Permanent geocoding, shared by the browser and the server.
 *
 * Mapbox's Search Box results are for temporary use only. Coordinates that
 * get stored must come from the Geocoding API with permanent=true (needs a
 * credit card on the Mapbox account). This module builds that request and
 * reads its answer; the caller supplies the token:
 *
 *  - Browser: the public token (NEXT_PUBLIC_MAPBOX_TOKEN). It's sent with
 *    the page's Referer, so a URL-restricted public token works. This is the
 *    default path: no secret token needed.
 *  - Server (optional): MAPBOX_SERVER_TOKEN, if one is configured. Server
 *    requests carry no Referer, so a URL-restricted public token can't be
 *    used there.
 *
 * Never logs the token or the address.
 */

export type PermanentResult =
  | { ok: true; lat: number; lng: number; fullAddress: string | null; mapboxId: string | null }
  | { ok: false; reason: "not_configured" | "not_found" | "failed" };

const ENDPOINT = "https://api.mapbox.com/search/geocode/v6/forward";

/** The forward request, or null when there's nothing to look up. */
export function permanentForwardUrl(
  address: string,
  token: string,
  near?: { lat: number; lng: number },
): URL | null {
  const q = address.trim().slice(0, 256);
  const t = token.trim();
  if (!q || !t) return null;
  const url = new URL(ENDPOINT);
  url.searchParams.set("q", q);
  url.searchParams.set("country", "au");
  url.searchParams.set("limit", "1");
  url.searchParams.set("permanent", "true");
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
    url.searchParams.set("proximity", `${near.lng},${near.lat}`);
  }
  url.searchParams.set("access_token", t);
  return url;
}

type ForwardBody = {
  features?: {
    id?: string;
    geometry?: { coordinates?: unknown };
    properties?: { full_address?: string; mapbox_id?: string };
  }[];
};

/** The first feature's point, or null if the answer has none. */
export function parsePermanentResponse(body: unknown): Extract<PermanentResult, { ok: true }> | null {
  const f = (body as ForwardBody | null)?.features?.[0];
  const c = f?.geometry?.coordinates;
  if (!f || !Array.isArray(c) || c.length < 2) return null;
  const [lng, lat] = c as [unknown, unknown];
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return null;
  return {
    ok: true,
    lat,
    lng,
    fullAddress: typeof f.properties?.full_address === "string" ? f.properties.full_address : null,
    mapboxId: f.properties?.mapbox_id ?? f.id ?? null,
  };
}

/** One permanent lookup. Never throws. */
export async function permanentGeocodeWith(
  token: string | null | undefined,
  address: string,
  near?: { lat: number; lng: number },
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 6000,
): Promise<PermanentResult> {
  if (!token?.trim()) return { ok: false, reason: "not_configured" };
  const url = permanentForwardUrl(address, token, near);
  if (!url) return { ok: false, reason: "not_found" };
  try {
    const res = await fetchImpl(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { ok: false, reason: "failed" };
    const parsed = parsePermanentResponse(await res.json());
    return parsed ?? { ok: false, reason: "not_found" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
