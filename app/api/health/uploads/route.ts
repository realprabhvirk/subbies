import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Multi-file upload self-check.
 *
 * Exists because `submitStagedDocuments` fails in production with an error
 * that only reaches a server-side console.error, and the contractor-facing
 * message is deliberately generic. This answers, against the *deployed*
 * environment rather than a local .env, the one question the logs would
 * otherwise be needed for:
 *
 *   does `contractor_document_files` actually exist and accept the exact
 *   insert that submit path performs, and if not, what is the literal
 *   PostgREST error?
 *
 * Protected with CRON_SECRET (same header shape as /api/health/billing):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/health/uploads
 *
 * A plain GET is strictly read-only. Add ?insert=1 to also attempt a real
 * insert with the same column shape the submit path uses, against a real
 * contractor_documents row, then delete it again — the only way to see the
 * actual write error rather than inferring it from a read.
 *
 * Never returns a secret, a file path belonging to a real upload, or any
 * contractor's data — only schema facts and error bodies.
 */

/** The columns submitStagedDocuments actually writes, per migration 0011. */
const WRITTEN_COLUMNS = ["id", "contractor_document_id", "file_path", "file_name", "created_at"];

/** Marks the throwaway row so it is obvious in the table if cleanup ever fails. */
const PROBE_PREFIX = "__healthcheck__";

interface PostgrestErrorReport {
  code: string | null;
  message: string | null;
  details: string | null;
  hint: string | null;
}

function reportError(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null): PostgrestErrorReport | null {
  if (!error) return null;
  return {
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  };
}

function describePresence(value: string | undefined): string {
  if (value === undefined) return "missing";
  if (!value.trim()) return "set but blank";
  if (value.trim() !== value) return "set (has leading/trailing whitespace — likely broken)";
  return "set";
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const runInsertProbe = new URL(req.url).searchParams.get("insert") === "1";

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: describePresence(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: describePresence(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  const notes: string[] = [];
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    return Response.json(
      {
        healthy: false,
        env,
        fatal: err instanceof Error ? err.message : String(err),
        notes: ["The service-role client could not even be constructed, so nothing was probed."],
      },
      { status: 200 },
    );
  }

  // 1. Does the table exist at all, as far as PostgREST is concerned?
  //    PGRST205 here means the table is genuinely unknown to the API layer —
  //    either it was never created, or it was created somewhere this project
  //    isn't looking. A schema reload does not fix a table that isn't there.
  const tableProbe = await admin.from("contractor_document_files").select("id").limit(1);
  const tableError = reportError(tableProbe.error);
  const tableExists = !tableProbe.error;

  if (tableError?.code === "PGRST205") {
    notes.push(
      "PGRST205 on a plain select means PostgREST has no such table. If a schema-cache reload was already tried, the table almost certainly does not exist in this project — re-check that migration 0011 ran against THIS Supabase project and against the public schema.",
    );
  }

  // 2. Control probe: the pre-existing table the old single-file flow wrote to.
  //    If this succeeds and the one above fails, the service-role key and the
  //    connection are fine and the problem is isolated to the new table.
  const controlProbe = await admin.from("contractor_documents").select("id").limit(1);
  const controlError = reportError(controlProbe.error);

  if (!controlProbe.error && !tableExists) {
    notes.push(
      "contractor_documents is readable but contractor_document_files is not — the service-role key, the URL and the network are all working. The fault is specific to the new table.",
    );
  }

  // 3. Which of the written columns does PostgREST know about?
  const columns: Record<string, string> = {};
  if (tableExists) {
    for (const column of WRITTEN_COLUMNS) {
      const { error } = await admin.from("contractor_document_files").select(column).limit(1);
      if (!error) {
        columns[column] = "present";
        continue;
      }
      const unknownColumn = error.code === "42703" || error.code === "PGRST204";
      columns[column] = unknownColumn
        ? `MISSING — ${error.message}`
        : `UNKNOWN — ${error.code ?? "no code"}: ${error.message}`;
    }
  }

  // 4. The real thing: the exact insert shape submitStagedDocuments performs.
  //    Read probes go through a different PostgREST code path than writes, so
  //    a clean select does not prove a write will succeed.
  let insertProbe: Record<string, unknown> = {
    attempted: false,
    reason: runInsertProbe
      ? null
      : "Add ?insert=1 to run it. Without it this endpoint is read-only.",
  };

  if (runInsertProbe && tableExists) {
    const { data: anyDoc, error: anyDocError } = await admin
      .from("contractor_documents")
      .select("id")
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (anyDocError || !anyDoc) {
      insertProbe = {
        attempted: false,
        reason: "No contractor_documents row exists to hang a probe row off, so the foreign key could not be satisfied.",
        error: reportError(anyDocError),
      };
    } else {
      const probePath = `${PROBE_PREFIX}/${crypto.randomUUID()}.pdf`;
      // Same three columns, same types, as the real submit path.
      const { data: inserted, error: insertError } = await admin
        .from("contractor_document_files")
        .insert({
          contractor_document_id: anyDoc.id,
          file_path: probePath,
          file_name: "healthcheck.pdf",
        })
        .select("id")
        .maybeSingle<{ id: string }>();

      if (insertError) {
        insertProbe = {
          attempted: true,
          ok: false,
          error: reportError(insertError),
          note: "This is the literal error the contractor's Submit is hitting.",
        };
      } else {
        // Clean up immediately. A probe row left behind would show up as a
        // phantom file against a real document requirement.
        const { error: cleanupError } = await admin
          .from("contractor_document_files")
          .delete()
          .eq("id", inserted!.id);

        insertProbe = {
          attempted: true,
          ok: true,
          cleanedUp: !cleanupError,
          cleanupError: reportError(cleanupError),
          note: cleanupError
            ? `A probe row was left behind at file_path ${probePath} — delete it manually.`
            : "Insert succeeded and the probe row was removed. The write path itself is healthy.",
        };
      }
    }
  }

  if (runInsertProbe && insertProbe.ok === true) {
    notes.push(
      "The exact insert the submit path performs succeeded here. That points away from schema and permissions, and toward something request-specific — re-run the failing submit and read the submitStagedDocuments console.error line for the real code.",
    );
  }

  const healthy =
    tableExists &&
    Object.values(columns).every((v) => v === "present") &&
    (!runInsertProbe || insertProbe.ok === true);

  return Response.json(
    {
      healthy,
      env,
      table: { name: "contractor_document_files", exists: tableExists, error: tableError },
      control: { name: "contractor_documents", readable: !controlProbe.error, error: controlError },
      columns,
      insertProbe,
      notes,
    },
    { status: 200 },
  );
}
