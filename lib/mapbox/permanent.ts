import "server-only";

import { permanentGeocodeWith, type PermanentResult } from "./geocode";

export type { PermanentResult };

/**
 * Server-side permanent lookup with MAPBOX_SERVER_TOKEN (never
 * NEXT_PUBLIC_). Optional: when it isn't set, the browser does the lookup
 * with the public token instead (see geocode.ts and location-save.ts).
 */
export async function permanentGeocode(address: string, near?: { lat: number; lng: number }): Promise<PermanentResult> {
  const r = await permanentGeocodeWith(process.env.MAPBOX_SERVER_TOKEN, address, near);
  if (!r.ok && r.reason === "failed") console.error("permanentGeocode: request failed");
  return r;
}
