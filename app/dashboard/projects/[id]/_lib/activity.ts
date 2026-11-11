import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface ActivityEvent {
  id: string;
  eventType: string;
  description: string;
  createdAt: string;
  /** "You" for the signed-in owner, "Contractor" for a token upload, "Subbies" for the daily job. */
  actor: string;
}

export const ACTIVITY_PAGE = 30;

/**
 * One page of a project's activity, newest first. Cursor = the last event's
 * "created_at|id", so pages never skip or repeat rows that share a timestamp.
 * RLS limits it to the caller's company; the project id is also checked by
 * the caller. Returns [] before migration 0022.
 */
export async function loadProjectActivity(
  projectId: string,
  opts: { limit?: number; cursor?: string | null } = {},
): Promise<{ events: ActivityEvent[]; nextCursor: string | null; error: boolean }> {
  const limit = Math.min(Math.max(opts.limit ?? ACTIVITY_PAGE, 1), 100);
  const supabase = await createClient();
  let q = supabase
    .from("project_activity")
    .select("id, event_type, description, created_at, actor_user_id, contractor_id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (opts.cursor) {
    const [at, id] = opts.cursor.split("|");
    if (at && id && /^[0-9a-f-]{36}$/i.test(id) && !Number.isNaN(Date.parse(at))) {
      q = q.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${id})`);
    }
  }

  const { data, error } = await q;
  if (error) {
    const missing = error.code === "42P01" || error.code === "PGRST205";
    if (!missing) console.error("loadProjectActivity failed", { code: error.code });
    return { events: [], nextCursor: null, error: !missing };
  }

  type Row = { id: string; event_type: string; description: string; created_at: string; actor_user_id: string | null; contractor_id: string | null };
  const rows = (data ?? []) as Row[];
  const page = rows.slice(0, limit);
  const events = page.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    description: r.description,
    createdAt: r.created_at,
    actor: r.actor_user_id
      ? "You"
      : r.event_type === "document_uploaded"
        ? "Contractor"
        : "Subbies",
  }));
  const last = page[page.length - 1];
  return { events, nextCursor: rows.length > limit && last ? `${last.created_at}|${last.id}` : null, error: false };
}
