"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireActiveCompany } from "@/lib/billing/require-active";
import { subbiesRpcCode } from "@/lib/db/rpc-errors";
import { PROJECT_PHOTOS_BUCKET } from "@/lib/photos/constants";

type Result = { ok: true } | { ok: false; error: string };

/** Row first, then the files (best-effort; the nightly sweep removes leftovers). */
export async function deleteProjectPhoto(projectId: string, photoId: string): Promise<Result> {
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_project_photo", { p_photo_id: photoId });
  if (error) {
    if (subbiesRpcCode(error) === "SUBBIES_NOT_FOUND") return { ok: false, error: "Couldn't find that photo." };
    console.error("deleteProjectPhoto failed", { code: error.code });
    return { ok: false, error: "Couldn't delete the photo. Try again." };
  }
  const old = (data as { old_storage_path: string; old_thumb_path: string }[] | null)?.[0];
  if (old) {
    const { error: rmError } = await supabase.storage.from(PROJECT_PHOTOS_BUCKET).remove([old.old_storage_path, old.old_thumb_path]);
    if (rmError) console.error("deleteProjectPhoto: file removal failed, the sweep will retry", { message: rmError.message });
  }
  revalidatePath(`/dashboard/projects/${projectId}`, "layout");
  return { ok: true };
}

export async function moveProjectPhoto(projectId: string, photoId: string, direction: -1 | 1): Promise<Result> {
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };
  if (direction !== -1 && direction !== 1) return { ok: false, error: "Couldn't move that photo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_project_photo", { p_photo_id: photoId, p_direction: direction });
  if (error) {
    console.error("moveProjectPhoto failed", { code: error.code });
    return { ok: false, error: "Couldn't move the photo. Try again." };
  }
  revalidatePath(`/dashboard/projects/${projectId}`, "layout");
  return { ok: true };
}
