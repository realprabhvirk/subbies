import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { SavedLocation } from "../_components/location-picker";

/**
 * The project's saved map location. Its own query so a deploy that lands
 * before migration 0023 just shows no map instead of breaking the page.
 * Cached per request, so the layout (report map) and overview share one query.
 */
export const loadProjectLocation = cache(async function loadProjectLocation(
  projectId: string,
  companyId: string,
): Promise<SavedLocation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("latitude, longitude, location_address, location_place_id, location_is_manual")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .maybeSingle<{ latitude: number | string | null; longitude: number | string | null; location_address: string | null; location_place_id: string | null; location_is_manual: boolean | null }>();
  if (error || !data || data.latitude === null || data.longitude === null) return null;
  return {
    lat: Number(data.latitude),
    lng: Number(data.longitude),
    address: data.location_address,
    placeId: data.location_place_id,
    manual: Boolean(data.location_is_manual),
  };
});
