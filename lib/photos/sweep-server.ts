import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { PROJECT_PHOTOS_BUCKET } from "./constants";
import { sweepOrphanPhotos } from "./sweep";

const PAGE = 1000;

/** The daily orphan sweep against the real bucket and table. Never throws. */
export async function sweepProjectPhotos(): Promise<{ removed: number; failed: number; skipped: boolean }> {
  try {
    const admin = createAdminClient();
    const bucket = admin.storage.from(PROJECT_PHOTOS_BUCKET);
    return await sweepOrphanPhotos({
      nowMs: Date.now(),
      lister: {
        list: async (prefix) => {
          const all: { name: string; id: string | null; created_at?: string | null }[] = [];
          for (let offset = 0; ; offset += PAGE) {
            const { data, error } = await bucket.list(prefix, { limit: PAGE, offset });
            if (error) throw error;
            all.push(...(data ?? []));
            if (!data || data.length < PAGE) break;
          }
          return { data: all, error: null };
        },
      },
      registeredPaths: async () => {
        const paths: string[] = [];
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await admin
            .from("project_photos")
            .select("storage_path, thumb_path")
            .range(from, from + PAGE - 1);
          if (error) {
            // Before migration 0023 there's no table and no bucket to sweep.
            return null;
          }
          for (const r of (data ?? []) as { storage_path: string; thumb_path: string }[]) paths.push(r.storage_path, r.thumb_path);
          if (!data || data.length < PAGE) break;
        }
        return paths;
      },
      remove: async (paths) => bucket.remove(paths),
    });
  } catch (err) {
    console.error("sweepProjectPhotos threw", { err: String(err) });
    return { removed: 0, failed: 0, skipped: true };
  }
}
