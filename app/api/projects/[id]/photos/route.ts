import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireActiveCompany } from "@/lib/billing/require-active";
import { subbiesRpcCode } from "@/lib/db/rpc-errors";
import { checkRateLimit, RATE_LIMITS, TOO_MANY_REQUESTS_MESSAGE } from "@/lib/rate-limit";
import { checkUpload, processPhoto, MAX_UPLOAD_BYTES } from "@/lib/photos/process";
import { PROJECT_PHOTOS_BUCKET, photoPaths } from "@/lib/photos/constants";
import { isUuid } from "@/lib/onboarding";

export const runtime = "nodejs";

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

/**
 * Upload (or replace) one jobsite photo. A route handler rather than a
 * server action so the body limit is the platform's, not the action's; the
 * client downscales first so requests stay well under Vercel's 4.5 MB cap.
 *
 * Order: session and company, project ownership, size, magic bytes, decode
 * and re-encode (EXIF and GPS stripped), store both files under the
 * company's folder (Storage policies enforce that too), then the database
 * row. The 3-slot cap is enforced by the database; if the row can't be
 * written the files just stored are removed.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/projects/[id]/photos">) {
  const { id: projectId } = await ctx.params;
  if (!isUuid(projectId)) return json(404, { ok: false, error: "Couldn't find that project." });

  const access = await requireActiveCompany();
  if (!access.ok) return json(403, { ok: false, error: access.error });
  const company = access.company;

  if (!(await checkRateLimit(RATE_LIMITS.photoUpload, company.id))) {
    return json(429, { ok: false, error: TOO_MANY_REQUESTS_MESSAGE });
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!project) return json(404, { ok: false, error: "Couldn't find that project." });

  // Refuse obviously oversized bodies before reading them.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return json(413, { ok: false, error: "That photo is too large. Choose one under 4 MB." });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(400, { ok: false, error: "That upload didn't come through. Try again." });
  }
  const file = form.get("file");
  const replaceId = form.get("replace");
  if (!(file instanceof File)) return json(400, { ok: false, error: "Choose a photo to upload." });
  if (replaceId !== null && (typeof replaceId !== "string" || !isUuid(replaceId))) {
    return json(400, { ok: false, error: "Couldn't find that photo." });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes);
  if (!check.ok) return json(415, { ok: false, error: check.error });

  let processed;
  try {
    processed = await processPhoto(bytes);
  } catch {
    return json(415, { ok: false, error: "That photo couldn't be read. Try a different one." });
  }

  const paths = photoPaths(company.id, projectId, randomUUID());
  const bucket = supabase.storage.from(PROJECT_PHOTOS_BUCKET);
  const [fullUp, thumbUp] = await Promise.all([
    bucket.upload(paths.full, processed.full, { contentType: "image/webp", upsert: false }),
    bucket.upload(paths.thumb, processed.thumb, { contentType: "image/webp", upsert: false }),
  ]);
  if (fullUp.error || thumbUp.error) {
    console.error("photo upload: storage write failed", { full: fullUp.error?.message, thumb: thumbUp.error?.message });
    await bucket.remove([paths.full, paths.thumb]);
    return json(500, { ok: false, error: "Couldn't save the photo. Try again." });
  }

  const filename = (file.name || "photo").slice(0, 255);
  const size = processed.full.length;
  const rpc = replaceId
    ? await supabase.rpc("replace_project_photo", {
        p_photo_id: replaceId,
        p_storage_path: paths.full,
        p_thumb_path: paths.thumb,
        p_original_filename: filename,
        p_size_bytes: size,
      })
    : await supabase.rpc("add_project_photo", {
        p_project_id: projectId,
        p_storage_path: paths.full,
        p_thumb_path: paths.thumb,
        p_original_filename: filename,
        p_size_bytes: size,
      });

  if (rpc.error) {
    await bucket.remove([paths.full, paths.thumb]);
    const code = subbiesRpcCode(rpc.error);
    if (code === "SUBBIES_PHOTO_LIMIT") {
      return json(409, { ok: false, error: "All 3 photo slots are used. Replace or delete one first." });
    }
    if (code === "SUBBIES_NOT_FOUND") return json(404, { ok: false, error: "Couldn't find that photo." });
    if (code === "SUBBIES_NO_ACCESS") return json(403, { ok: false, error: "Your Subbies access has ended." });
    console.error("photo upload: row write failed", { code: rpc.error.code, message: rpc.error.message });
    return json(500, { ok: false, error: "Couldn't save the photo. Try again." });
  }

  // Replacing: the old files go now (best-effort; the nightly sweep catches leftovers).
  if (replaceId) {
    const old = (rpc.data as { old_storage_path: string; old_thumb_path: string }[] | null)?.[0];
    if (old) await bucket.remove([old.old_storage_path, old.old_thumb_path]);
  }

  revalidatePath(`/dashboard/projects/${projectId}`, "layout");
  return json(200, { ok: true });
}
