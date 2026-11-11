import "server-only";

import { createClient } from "@/lib/supabase/server";
import { PROJECT_PHOTOS_BUCKET } from "@/lib/photos/constants";

export interface PhotoView {
  id: string;
  position: number;
  thumbUrl: string | null;
  fullUrl: string | null;
  filename: string | null;
}

const SIGNED_URL_SECONDS = 3600;

/**
 * The project's photos with signed URLs (about an hour), all made in one
 * batch call with the signed-in user's client, so Storage policies apply.
 * Returns [] before migration 0023.
 */
export async function loadProjectPhotos(projectId: string): Promise<PhotoView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_photos")
    .select("id, position, storage_path, thumb_path, original_filename")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error || !data || data.length === 0) return [];

  type Row = { id: string; position: number; storage_path: string; thumb_path: string; original_filename: string | null };
  const rows = data as Row[];
  const paths = rows.flatMap((r) => [r.thumb_path, r.storage_path]);
  const { data: signed } = await supabase.storage.from(PROJECT_PHOTOS_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  const url = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    position: r.position,
    thumbUrl: url.get(r.thumb_path) ?? null,
    fullUrl: url.get(r.storage_path) ?? null,
    filename: r.original_filename,
  }));
}
