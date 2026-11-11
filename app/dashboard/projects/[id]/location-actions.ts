"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireActiveCompany } from "@/lib/billing/require-active";
import { rpcErrorMessage, subbiesRpcCode } from "@/lib/db/rpc-errors";
import { permanentGeocode } from "@/lib/mapbox/permanent";
import { decideLocationSave, type LocationSaveInput } from "@/lib/projects/location-save";

type Result = { ok: true } | { ok: false; error: string };

export type LocationInput = LocationSaveInput;

/**
 * Saves the project's map location. The rules (hand-placed pins stored as
 * placed; searched pins only once confirmed by permanent geocoding) live in
 * lib/projects/location-save.ts.
 */
export async function saveProjectLocation(projectId: string, input: LocationInput): Promise<Result> {
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };

  const decision = await decideLocationSave(input, permanentGeocode);
  if (!decision.ok) return decision;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_project_location", {
    p_project_id: projectId,
    p_address: decision.address,
    p_latitude: decision.lat,
    p_longitude: decision.lng,
    p_place_id: decision.placeId,
    p_is_manual: decision.manual,
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
