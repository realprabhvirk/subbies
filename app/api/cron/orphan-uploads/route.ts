import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { deleteObjects, listAllDocumentObjects } from "@/lib/storage";
import { orphanObjects, ORPHAN_MIN_AGE_MS } from "@/lib/storage-cleanup-logic";
import { hasCronSecret } from "@/lib/security/secret-compare";

export const runtime = "nodejs";

const PAGE = 1000;

/**
 * Finds uploaded files that no database row points at and, when asked,
 * deletes them (M1).
 *
 * Report-only unless called with `?dry=0`:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/orphan-uploads
 *   curl -H "Authorization: Bearer $CRON_SECRET" "https://<app>/api/cron/orphan-uploads?dry=0"
 *
 * Only files stored more than 24 hours ago are ever deleted, so an upload
 * that's mid-submit is safe. A file counts as registered if a
 * contractor_document_files row OR a legacy contractor_documents.file_url
 * points at it (older documents only have the latter).
 *
 * Logs and returns counts only, never paths or ids.
 */
export async function GET(req: NextRequest) {
  if (!hasCronSecret(req.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const dry = new URL(req.url).searchParams.get("dry") !== "0";
  const admin = createAdminClient();

  // Everything the database knows about. If either read fails, stop: a
  // partial list would make real documents look like orphans.
  const registered: string[] = [];
  for (const [table, column] of [
    ["contractor_document_files", "file_path"],
    ["contractor_documents", "file_url"],
  ] as const) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from(table)
        .select(column)
        .not(column, "is", null)
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("orphan-uploads: couldn't read registered paths, nothing deleted", { table, code: error.code });
        return Response.json({ ok: false, error: "registered path lookup failed" }, { status: 500 });
      }
      for (const row of data ?? []) registered.push((row as Record<string, string>)[column]);
      if (!data || data.length < PAGE) break;
    }
  }

  let objects;
  try {
    objects = await listAllDocumentObjects();
  } catch (error) {
    console.error("orphan-uploads: storage listing failed, nothing deleted", { error });
    return Response.json({ ok: false, error: "storage listing failed" }, { status: 500 });
  }

  const orphans = orphanObjects(objects, registered, Date.now(), ORPHAN_MIN_AGE_MS);

  let deleted = 0;
  let failed = 0;
  if (!dry && orphans.length > 0) {
    const result = await deleteObjects(orphans.map((o) => o.path), { job: "orphan-uploads" });
    deleted = result.deletedCount;
    failed = result.failedPaths.length;
  }

  const summary = {
    ok: failed === 0,
    dry,
    scanned: objects.length,
    registered: registered.length,
    orphans: orphans.length,
    deleted,
    failed,
  };
  console.log("orphan-uploads", summary);
  return Response.json(summary);
}
