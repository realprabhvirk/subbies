"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireActiveCompany } from "@/lib/billing/require-active";
import { rpcErrorMessage, subbiesRpcCode } from "@/lib/db/rpc-errors";
import { isValidCoordinate } from "@/lib/mapbox/static-map";
import { permanentGeocode } from "@/lib/mapbox/permanent";

type Result = { ok: true } | { ok: false; error: string };

export interface LocationInput {
  address: string;
  lat: number;
  lng: number;
  placeId: string | null;
  /** The pin was placed or moved by hand (click, drag or crosshair). */
  manual: boolean;
}

/**
 * Saves the project's map location. A pin placed by hand is stored as the
 * user placed it. A location chosen from search is looked up once with
 * permanent geocoding and that result's coordinates are stored (Mapbox's
 * search results are for temporary use only).
 */
export async function saveProjectLocation(projectId: string, input: LocationInput): Promise<Result> {
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };

  const address = typeof input?.address === "string" ? input.address.trim().slice(0, 300) : "";
  if (!isValidCoordinate(input?.lat, input?.lng)) return { ok: false, error: "Place the pin on the map first." };
  let { lat, lng } = input;
  let placeId = typeof input.placeId === "string" ? input.placeId.slice(0, 300) : null;
  const manual = Boolean(input.manual);

  if (!manual) {
    if (!address) return { ok: false, error: "Choose an address, or place the pin yourself." };
    const permanent = await permanentGeocode(address, { lat, lng });
    if (!permanent.ok) {
      return {
        ok: false,
        error:
          permanent.reason === "not_configured"
            ? "Saving a searched address isn't set up yet. Place the pin on the map yourself, then save."
            : permanent.reason === "not_found"
              ? "Couldn't confirm that address. Place the pin on the map yourself, then save."
              : "Couldn't confirm that address right now. Try again, or place the pin yourself.",
      };
    }
    lat = permanent.lat;
    lng = permanent.lng;
    placeId = permanent.mapboxId ?? placeId;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_project_location", {
    p_project_id: projectId,
    p_address: address || null,
    p_latitude: lat,
    p_longitude: lng,
    p_place_id: placeId,
    p_is_manual: manual,
  });
  if (error) {
    if (subbiesRpcCode(error)) return { ok: false, error: rpcErrorMessage(error, "projects") };
    console.error("saveProjectLocation failed", { code: error.code });
    return { ok: false, error: "Couldn't save the location. Try again." };
  }
  revalidatePath(`/dashboard/projects/${projectId}`, "layout");
  return { ok: true };
}

export async function clearProjectLocation(projectId: string): Promise<Result> {
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_project_location", { p_project_id: projectId });
  if (error) {
    if (subbiesRpcCode(error)) return { ok: false, error: rpcErrorMessage(error, "projects") };
    console.error("clearProjectLocation failed", { code: error.code });
    return { ok: false, error: "Couldn't remove the location. Try again." };
  }
  revalidatePath(`/dashboard/projects/${projectId}`, "layout");
  return { ok: true };
}
