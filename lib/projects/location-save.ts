import type { PermanentResult } from "../mapbox/geocode.ts";
import { isValidCoordinate } from "../mapbox/static-map.ts";

/**
 * Decides what gets stored when a project location is saved. Pure, so the
 * rules are unit-tested without Supabase or Mapbox.
 *
 *  - A pin placed or moved by hand is stored exactly as placed.
 *  - A pin from search must be confirmed by permanent geocoding before it's
 *    stored (Mapbox terms). The browser does that with the public token and
 *    sends `confirmed`; those coordinates are stored. If the browser couldn't
 *    confirm it, the server tries once with its own token, when one is set.
 *
 * Trusting the browser's `confirmed` coordinates adds no new power: a user
 * can already store any point by placing the pin by hand. It only decides
 * which Mapbox mode the coordinates came from.
 */
export interface LocationSaveInput {
  address: string;
  lat: number;
  lng: number;
  placeId: string | null;
  manual: boolean;
  /** Set by the browser after a successful permanent lookup. */
  confirmed?: { lat: number; lng: number; mapboxId: string | null } | null;
}

export type LocationSaveDecision =
  | { ok: true; address: string | null; lat: number; lng: number; placeId: string | null; manual: boolean }
  | { ok: false; error: string };

export async function decideLocationSave(
  input: Partial<LocationSaveInput> | null | undefined,
  serverLookup: (address: string, near: { lat: number; lng: number }) => Promise<PermanentResult>,
): Promise<LocationSaveDecision> {
  const address = typeof input?.address === "string" ? input.address.trim().slice(0, 300) : "";
  if (!input || !isValidCoordinate(input.lat, input.lng)) return { ok: false, error: "Place the pin on the map first." };
  const placeId = typeof input.placeId === "string" ? input.placeId.slice(0, 300) : null;
  const manual = input.manual === true;

  if (manual) return { ok: true, address: address || null, lat: input.lat, lng: input.lng as number, placeId, manual };

  if (!address) return { ok: false, error: "Choose an address, or place the pin yourself." };

  const c = input.confirmed;
  if (c && isValidCoordinate(c.lat, c.lng)) {
    const id = typeof c.mapboxId === "string" ? c.mapboxId.slice(0, 300) : placeId;
    return { ok: true, address, lat: c.lat, lng: c.lng, placeId: id, manual: false };
  }

  const r = await serverLookup(address, { lat: input.lat, lng: input.lng as number });
  if (r.ok) return { ok: true, address, lat: r.lat, lng: r.lng, placeId: r.mapboxId ?? placeId, manual: false };
  return {
    ok: false,
    error:
      r.reason === "failed"
        ? "Couldn't confirm that address right now. Try again, or place the pin yourself."
        : "Couldn't confirm that address. Place the pin on the map yourself, then save.",
  };
}
