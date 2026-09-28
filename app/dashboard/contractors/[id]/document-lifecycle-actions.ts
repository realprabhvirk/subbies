"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { recomputeContractorStatus } from "@/lib/contractor-status";
import { deleteFilesUnderPrefix } from "@/lib/storage";
import {
  canArchiveOrDelete,
  planArchive,
  planDelete,
  type LifecycleRow,
} from "@/lib/document-lifecycle-logic";
import type { DocumentStatus } from "@/lib/types";

const SESSION_EXPIRED = "Your session has expired. Reload and try again.";

interface LoadedForLifecycle {
  doc: {
    id: string;
    status: DocumentStatus;
    contractor_id: string;
    document_type_id: string;
    archived_at: string | null;
    replaces_document_id: string | null;
    file_url: string | null;
  };
  contractor: { id: string; business_name: string };
  /** Every non-archived row for this requirement, so plans can see replacements. */
  siblings: LifecycleRow[];
}

/**
 * Loads a document for archive/delete, proving the caller owns it. Unlike the
 * loader the review actions use, this one DOES return an archived row: the
 * history list deletes those.
 *
 * Ownership is the document -> contractor -> company chain, the same one the
 * RLS policy walks; a document id belonging to another company finds no
 * contractor here and comes back as "not found" rather than as a permission
 * error that would confirm it exists.
 */
async function loadForLifecycle(
  supabase: SupabaseClient,
  companyId: string,
  documentId: string,
): Promise<LoadedForLifecycle | null> {
  const { data: doc } = await supabase
    .from("contractor_documents")
    .select(
      "id, status, contractor_id, document_type_id, archived_at, replaces_document_id, file_url",
    )
    .eq("id", documentId)
    .maybeSingle<LoadedForLifecycle["doc"]>();

  if (!doc) return null;

  const { data: contractor } = await supabase
    .from("contractors")
    .select("id, business_name")
    .eq("id", doc.contractor_id)
    .eq("company_id", companyId)
    .maybeSingle<{ id: string; business_name: string }>();

  if (!contractor) return null;

  const { data: siblings } = await supabase
    .from("contractor_documents")
    .select("id, status, archived_at, replaces_document_id")
    .eq("contractor_id", contractor.id)
    .eq("document_type_id", doc.document_type_id)
    .is("archived_at", null);

  return {
    doc,
    contractor,
    siblings: (siblings ?? []) as LifecycleRow[],
  };
}

function revalidateContractor(contractorId: string) {
  revalidatePath(`/dashboard/contractors/${contractorId}`);
  revalidatePath("/dashboard/contractors");
  revalidatePath("/dashboard");
}

// --- archive ----------------------------------------------------------------

/**
 * Moves a document into the contractor's history. The file STAYS in private
 * storage, kept purely as a record; nothing that decides compliance, the
 * dashboard, reminders, emails or the contractor's page sees it any more.
 *
 * Archiving the only live copy must not make the requirement disappear — a
 * contractor with every other document approved would then read as fully
 * compliant with a required document missing. So a fresh "requested" row takes
 * its place (it shows as Missing), or, if a replacement was already on its way,
 * that replacement is promoted. The new row is created BEFORE the archive, and
 * removed again if the archive then fails, so the requirement is never absent.
 */
export async function archiveDocument(
  documentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: SESSION_EXPIRED };
  if (typeof documentId !== "string" || !documentId) {
    return { ok: false, error: "Couldn't find that document." };
  }

  const supabase = await createClient();
  const loaded = await loadForLifecycle(supabase, company.id, documentId);
  if (!loaded) return { ok: false, error: "Couldn't find that document." };

  const { doc, contractor, siblings } = loaded;
  if (doc.archived_at !== null) return { ok: false, error: "That document is already archived." };
  if (!canArchiveOrDelete(doc.status)) {
    return {
      ok: false,
      error: "Only a document the contractor has uploaded can be archived.",
    };
  }

  const plan = planArchive(doc, siblings);
  const nowIso = new Date().toISOString();

  let placeholderId: string | null = null;
  if (plan.kind === "archive_and_placeholder") {
    const { data: inserted, error } = await supabase
      .from("contractor_documents")
      .insert({
        contractor_id: contractor.id,
        document_type_id: doc.document_type_id,
        status: "requested",
      })
      .select("id")
      .single<{ id: string }>();

    if (error || !inserted) {
      console.error("archiveDocument: placeholder insert failed", error);
      return { ok: false, error: "Couldn't archive this document. Nothing was changed. Try again." };
    }
    placeholderId = inserted.id;
  }

  /** Undoes whatever this call did so far, so a failure leaves the data as it was. */
  const undo = async (unarchive: boolean) => {
    if (placeholderId) {
      const { error } = await supabase
        .from("contractor_documents")
        .delete()
        .eq("id", placeholderId);
      if (error) console.error("archiveDocument: couldn't remove placeholder", error);
    }
    if (unarchive) {
      const { error } = await supabase
        .from("contractor_documents")
        .update({ archived_at: null })
        .eq("id", doc.id);
      if (error) console.error("archiveDocument: couldn't un-archive", error);
    }
  };

  const { data: archived, error: archiveError } = await supabase
    .from("contractor_documents")
    .update({ archived_at: nowIso, updated_at: nowIso })
    .eq("id", doc.id)
    .eq("contractor_id", contractor.id)
    .is("archived_at", null)
    .select("id");

  if (archiveError || !archived || archived.length === 0) {
    console.error("archiveDocument: archive failed", archiveError);
    await undo(false);
    return { ok: false, error: "Couldn't archive this document. Nothing was changed. Try again." };
  }

  if (plan.kind === "archive_and_promote") {
    const { error } = await supabase
      .from("contractor_documents")
      .update({ replaces_document_id: null, updated_at: nowIso })
      .eq("id", plan.promoteId)
      .eq("contractor_id", contractor.id);
    if (error) {
      console.error("archiveDocument: promote failed", error);
      await undo(true);
      return { ok: false, error: "Couldn't archive this document. Nothing was changed. Try again." };
    }
  }

  await recomputeContractorStatus(supabase, contractor.id);
  revalidateContractor(contractor.id);
  return { ok: true };
}

// --- delete -----------------------------------------------------------------

/**
 * Permanently deletes a document: its files come out of storage AND its
 * database record goes. Used both on live documents and on archived ones from
 * the history list. Cannot be undone.
 *
 * Ordering follows the same rule as deleting a contractor: files first, and
 * if ANY can't be removed (or the listing itself fails) it stops with nothing
 * deleted, because the database row is the only record of which files belong to
 * whom. Deleting it first and then failing on the files would leave objects
 * nothing points at. A failed delete is safe to retry.
 *
 * Deleting the only live copy resets that SAME row to "requested" instead of
 * deleting it (see planDelete): the requirement returns to Missing without ever
 * being absent from compliance, and with no insert that could fail after the
 * delete has already happened.
 */
export async function deleteDocument(
  documentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: SESSION_EXPIRED };
  if (typeof documentId !== "string" || !documentId) {
    return { ok: false, error: "Couldn't find that document." };
  }

  const supabase = await createClient();
  const loaded = await loadForLifecycle(supabase, company.id, documentId);
  if (!loaded) return { ok: false, error: "Couldn't find that document." };

  const { doc, contractor, siblings } = loaded;
  const isArchived = doc.archived_at !== null;
  if (!isArchived && !canArchiveOrDelete(doc.status)) {
    return {
      ok: false,
      error: "There's nothing to delete yet. Revoke the request instead.",
    };
  }

  // Every path the database knows about for this document, so a file that
  // doesn't sit under the expected folder is still removed.
  const { data: fileRows, error: filesError } = await supabase
    .from("contractor_document_files")
    .select("file_path")
    .eq("contractor_document_id", doc.id);

  if (filesError) {
    console.error("deleteDocument: couldn't read file records", filesError);
    return { ok: false, error: "Couldn't delete this document. Nothing was changed. Try again." };
  }

  const knownPaths = [
    ...((fileRows ?? []) as { file_path: string }[]).map((f) => f.file_path),
    ...(doc.file_url ? [doc.file_url] : []),
  ];

  const removed = await deleteFilesUnderPrefix(
    `${company.id}/${contractor.id}/${doc.id}`,
    knownPaths,
  );
  if (removed.listFailed || removed.failedPaths.length > 0) {
    console.error("deleteDocument: files could not be fully removed, aborting", {
      documentId: doc.id,
      listFailed: removed.listFailed,
      failed: removed.failedPaths.length,
    });
    return {
      ok: false,
      error: "We couldn't remove all of this document's files, so it wasn't deleted. Try again.",
    };
  }

  const plan = planDelete(doc, isArchived ? [] : siblings);
  const nowIso = new Date().toISOString();

  if (plan.kind === "delete_row") {
    // File records cascade; a pending replacement, if any, is promoted to the
    // live document by the foreign key's ON DELETE SET NULL.
    const { data: deleted, error } = await supabase
      .from("contractor_documents")
      .delete()
      .eq("id", doc.id)
      .eq("contractor_id", contractor.id)
      .select("id");
    if (error || !deleted || deleted.length === 0) {
      console.error("deleteDocument: row delete failed", error);
      return {
        ok: false,
        error: "The files were removed but the record couldn't be deleted. Try again.",
      };
    }
  } else {
    const { error: recordsError } = await supabase
      .from("contractor_document_files")
      .delete()
      .eq("contractor_document_id", doc.id);
    if (recordsError) {
      console.error("deleteDocument: file record delete failed", recordsError);
      return {
        ok: false,
        error: "The files were removed but the record couldn't be cleared. Try again.",
      };
    }

    const { error } = await supabase
      .from("contractor_documents")
      .update({
        status: "requested",
        file_url: null,
        expiry_date: null,
        rejection_reason: null,
        updated_at: nowIso,
      })
      .eq("id", doc.id)
      .eq("contractor_id", contractor.id);
    if (error) {
      console.error("deleteDocument: reset failed", error);
      return {
        ok: false,
        error: "The files were removed but the record couldn't be reset. Try again.",
      };
    }
  }

  await recomputeContractorStatus(supabase, contractor.id);
  revalidateContractor(contractor.id);
  return { ok: true };
}
