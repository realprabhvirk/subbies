/**
 * Nightly sweep of the project-photos bucket: removes files no project_photos
 * row points at, once they're over an hour old (so an upload that's still
 * mid-flight is never touched). Runs inside the existing daily cron.
 *
 * Fails closed: if either the listing or the database read fails, nothing is
 * deleted (a partial list would make real photos look orphaned).
 */
import { collectAllObjects, orphanObjects, batchPaths, type StorageLister } from "../storage-cleanup-logic.ts";

export const PHOTO_ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

export interface PhotoSweepDeps {
  lister: StorageLister;
  /** Every storage_path and thumb_path in project_photos, or null on failure. */
  registeredPaths: () => Promise<string[] | null>;
  remove: (paths: string[]) => Promise<{ error: unknown }>;
  nowMs: number;
}

export async function sweepOrphanPhotos(deps: PhotoSweepDeps): Promise<{ removed: number; failed: number; skipped: boolean }> {
  let objects;
  try {
    objects = await collectAllObjects(deps.lister, "");
  } catch {
    return { removed: 0, failed: 0, skipped: true };
  }
  const registered = await deps.registeredPaths();
  if (registered === null) return { removed: 0, failed: 0, skipped: true };

  const orphans = orphanObjects(objects, registered, deps.nowMs, PHOTO_ORPHAN_MIN_AGE_MS).map((o) => o.path);
  let removed = 0;
  let failed = 0;
  for (const batch of batchPaths(orphans, 100)) {
    const { error } = await deps.remove(batch);
    if (error) failed += batch.length;
    else removed += batch.length;
  }
  return { removed, failed, skipped: false };
}
