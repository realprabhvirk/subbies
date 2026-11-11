import "server-only";

/**
 * Permanent geocoding for saved locations. Mapbox's Search Box results are
 * for temporary use only; storing coordinates from a search result needs the
 * Geocoding API's permanent mode (see docs/upgrade/PLAN.md). So when a
 * location chosen from search is saved, the server looks the address up once
 * with permanent=true and stores that result. Pins placed by hand are the
 * user's own coordinates and skip this.
 *
 * Server token only (MAPBOX_SERVER_TOKEN, never NEXT_PUBLIC_). One call per
 * saved location. Never logs the token or the address.
 */
export type PermanentResult =
  | { ok: true; lat: number; lng: number; fullAddress: string | null; mapboxId: string | null }
  | { ok: false; reason: "not_configured" | "not_found" | "failed" };

export async function permanentGeocode(address: string, near?: { lat: number; lng: number }): Promise<PermanentResult> {
  const token = process.env.MAPBOX_SERVER_TOKEN?.trim();
  if (!token) return { ok: false, reason: "not_configured" };
  const q = address.trim().slice(0, 256);
  if (!q) return { ok: false, reason: "not_found" };

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", q);
  url.searchParams.set("country", "au");
  url.searchParams.set("limit", "1");
  url.searchParams.set("permanent", "true");
  if (near) url.searchParams.set("proximity", `${near.lng},${near.lat}`);
  url.searchParams.set("access_token", token);

  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      console.error("permanentGeocode: request failed", { status: res.status });
      return { ok: false, reason: "failed" };
    }
    const body = (await res.json()) as {
      features?: { id?: string; geometry?: { coordinates?: [number, number] }; properties?: { full_address?: string; mapbox_id?: string } }[];
    };
    const f = body.features?.[0];
    const coords = f?.geometry?.coordinates;
    if (!f || !coords) return { ok: false, reason: "not_found" };
    return {
      ok: true,
      lng: coords[0],
      lat: coords[1],
      fullAddress: f.properties?.full_address ?? null,
      mapboxId: f.properties?.mapbox_id ?? f.id ?? null,
    };
  } catch {
    console.error("permanentGeocode: request threw");
    return { ok: false, reason: "failed" };
  }
}
