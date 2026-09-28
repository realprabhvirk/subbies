"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompany, getUser } from "@/lib/supabase/dal";
import {
  formatNoteTimestamp,
  validateNoteBody,
} from "@/lib/contractor-notes-logic";

const SESSION_EXPIRED = "Your session has expired. Reload and try again.";

export interface NoteView {
  id: string;
  body: string;
  /** Pre-formatted on the server (Sydney time), so it can't differ between server and browser. */
  createdLabel: string;
}

/** A missing table means migration 0015 hasn't been run on this project yet. */
function isMissingTable(code: string | undefined): boolean {
  return code === "42P01" || code === "PGRST205";
}

/**
 * Adds a private note to a contractor. Notes belong to the company alone: they
 * are read only through the company's own signed-in session and never appear on
 * the contractor's upload page or in any email (a test enforces that no
 * contractor-facing file references the table).
 *
 * The note is filed under the caller's OWN company and authored by the caller,
 * both taken from the session, never from the request; the contractor must
 * belong to that company or it isn't found. RLS re-checks all three.
 */
export async function addContractorNote(
  contractorId: string,
  body: string,
): Promise<{ ok: true; note: NoteView } | { ok: false; error: string }> {
  const company = await getCompany();
  const user = await getUser();
  if (!company || !user) return { ok: false, error: SESSION_EXPIRED };
  if (typeof contractorId !== "string" || !contractorId) {
    return { ok: false, error: "Couldn't find that contractor." };
  }

  const checked = validateNoteBody(body);
  if (!checked.ok) return { ok: false, error: checked.error };

  const supabase = await createClient();

  const { data: contractor } = await supabase
    .from("contractors")
    .select("id")
    .eq("id", contractorId)
    .eq("company_id", company.id)
    .maybeSingle<{ id: string }>();
  if (!contractor) return { ok: false, error: "Couldn't find that contractor." };

  const { data, error } = await supabase
    .from("contractor_notes")
    .insert({
      contractor_id: contractor.id,
      company_id: company.id,
      author_id: user.id,
      body: checked.value,
    })
    .select("id, body, created_at")
    .single<{ id: string; body: string; created_at: string }>();

  if (error || !data) {
    console.error("addContractorNote failed", { code: error?.code, message: error?.message });
    if (isMissingTable(error?.code)) {
      return {
        ok: false,
        error: "Notes aren't available yet: a pending database update hasn't been applied.",
      };
    }
    return { ok: false, error: "Couldn't save the note. Try again." };
  }

  revalidatePath(`/dashboard/contractors/${contractor.id}`);
  return {
    ok: true,
    note: { id: data.id, body: data.body, createdLabel: formatNoteTimestamp(data.created_at) },
  };
}

/** Permanently deletes one note. Scoped to the caller's company as well as RLS. */
export async function deleteContractorNote(
  noteId: string,
): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: SESSION_EXPIRED };
  if (typeof noteId !== "string" || !noteId) {
    return { ok: false, error: "Couldn't find that note." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractor_notes")
    .delete()
    .eq("id", noteId)
    .eq("company_id", company.id)
    .select("id, contractor_id");

  if (error) {
    console.error("deleteContractorNote failed", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't delete the note. Try again." };
  }
  if (!data || data.length === 0) return { ok: false, error: "Couldn't find that note." };

  revalidatePath(`/dashboard/contractors/${(data[0] as { contractor_id: string }).contractor_id}`);
  return { ok: true };
}
