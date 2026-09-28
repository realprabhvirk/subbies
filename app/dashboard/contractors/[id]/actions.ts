"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { getCompany, getUser } from "@/lib/supabase/dal";
import { getAppUrl } from "@/lib/app-url";
import { recomputeContractorStatus } from "@/lib/contractor-status";
import { createSignedDownload } from "@/lib/storage";
import {
  sendDocumentRejectedEmail,
  sendContractorApprovedEmail,
} from "@/lib/email/onboarding";
import { refreshTokenExpiry } from "@/lib/contractors/request-email";
import { resendDocumentRequests } from "./manage-actions";
import {
  canRevoke,
  canEditApprovedExpiry,
  isValidApprovalExpiry,
  isValidCorrectedExpiry,
} from "@/lib/document-actions-logic";
import { originalToArchiveOnApprove } from "@/lib/document-lifecycle-logic";
import type { DocumentStatus } from "@/lib/types";

interface LoadedDoc {
  doc: {
    id: string;
    status: DocumentStatus;
    contractor_id: string;
    documentName: string;
    /** Set when this row is a pending replacement for an approved document. */
    replacesDocumentId: string | null;
  };
  contractor: {
    id: string;
    business_name: string;
    contact_name: string | null;
    email: string;
    status: string;
  };
  token: string | null;
}

async function loadDocForCompany(
  supabase: SupabaseClient,
  companyId: string,
  contractorDocumentId: string,
): Promise<LoadedDoc | null> {
  const { data: doc } = await supabase
    .from("contractor_documents")
    .select("id, status, contractor_id, archived_at, replaces_document_id, document_types(name)")
    .eq("id", contractorDocumentId)
    .maybeSingle<{
      id: string;
      status: DocumentStatus;
      contractor_id: string;
      archived_at: string | null;
      replaces_document_id: string | null;
      document_types: { name: string } | null;
    }>();

  // An archived document is a record. Approve, reject, revoke and the rest
  // all act on live documents, so a stale page pointing at one gets "not
  // found" rather than quietly editing history.
  if (!doc || doc.archived_at !== null) return null;

  const { data: contractor } = await supabase
    .from("contractors")
    .select("id, business_name, contact_name, email, status")
    .eq("id", doc.contractor_id)
    .eq("company_id", companyId)
    .maybeSingle<{
      id: string;
      business_name: string;
      contact_name: string | null;
      email: string;
      status: string;
    }>();

  if (!contractor) return null;

  const { data: tokenRow } = await supabase
    .from("contractor_tokens")
    .select("token")
    .eq("contractor_id", contractor.id)
    .maybeSingle<{ token: string }>();

  return {
    doc: {
      id: doc.id,
      status: doc.status,
      contractor_id: doc.contractor_id,
      documentName: doc.document_types?.name ?? "Document",
      replacesDocumentId: doc.replaces_document_id,
    },
    contractor,
    token: tokenRow?.token ?? null,
  };
}

export async function approveDocument(
  contractorDocumentId: string,
  expiryDate: string,
): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };
  const user = await getUser();

  const validity = isValidApprovalExpiry(expiryDate);
  if (!validity.ok) {
    return { ok: false, error: validity.error };
  }

  const supabase = await createClient();
  const loaded = await loadDocForCompany(supabase, company.id, contractorDocumentId);
  if (!loaded) return { ok: false, error: "Couldn't find that document." };
  if (loaded.doc.status !== "uploaded") {
    return { ok: false, error: "This document isn't awaiting review." };
  }

  // Approving a REPLACEMENT is what retires the copy it replaces. The original
  // is archived first, and put back if the approval itself then fails, so the
  // two never end up both live (double-counted) or both hidden (the
  // requirement missing from compliance) after a failure part-way through.
  const nowIso = new Date().toISOString();
  const originalId = originalToArchiveOnApprove({
    replaces_document_id: loaded.doc.replacesDocumentId,
  });
  let archivedOriginal = false;

  if (originalId) {
    const { data: archived, error: archiveError } = await supabase
      .from("contractor_documents")
      .update({ archived_at: nowIso, updated_at: nowIso })
      .eq("id", originalId)
      .eq("contractor_id", loaded.contractor.id)
      .is("archived_at", null)
      .select("id");

    if (archiveError) {
      console.error("approveDocument: couldn't archive the replaced copy", archiveError);
      return {
        ok: false,
        error: "Couldn't replace the previous copy, so nothing was changed. Try again.",
      };
    }
    archivedOriginal = (archived?.length ?? 0) > 0;
  }

  const { error } = await supabase
    .from("contractor_documents")
    .update({
      status: "approved",
      expiry_date: expiryDate,
      rejection_reason: null,
      // Now the live document: the link to what it replaced is spent.
      replaces_document_id: null,
      updated_at: nowIso,
    })
    .eq("id", loaded.doc.id);

  if (error) {
    console.error("approveDocument failed", error);
    if (archivedOriginal && originalId) {
      const { error: restoreError } = await supabase
        .from("contractor_documents")
        .update({ archived_at: null })
        .eq("id", originalId);
      if (restoreError) {
        console.error("approveDocument: couldn't restore the replaced copy", restoreError);
      }
    }
    return { ok: false, error: "Couldn't approve this document. Try again." };
  }

  const newStatus = await recomputeContractorStatus(supabase, loaded.contractor.id);

  // Tell the contractor once everything is approved.
  if (newStatus === "approved" && loaded.contractor.status !== "approved") {
    await sendContractorApprovedEmail({
      to: loaded.contractor.email,
      contactName: loaded.contractor.contact_name,
      companyName: company.name,
      replyTo: user?.email ?? null,
      businessName: loaded.contractor.business_name,
    });
  }

  revalidatePath(`/dashboard/contractors/${loaded.contractor.id}`);
  revalidatePath("/dashboard/contractors");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function rejectDocument(
  contractorDocumentId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string; emailWarning?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };
  const user = await getUser();

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "Add a short reason so the contractor knows what to fix." };
  if (trimmed.length > 500) return { ok: false, error: "Keep the reason under 500 characters." };

  const supabase = await createClient();
  const loaded = await loadDocForCompany(supabase, company.id, contractorDocumentId);
  if (!loaded) return { ok: false, error: "Couldn't find that document." };
  if (loaded.doc.status !== "uploaded") {
    return { ok: false, error: "This document isn't awaiting review." };
  }

  const { error } = await supabase
    .from("contractor_documents")
    .update({
      status: "rejected",
      rejection_reason: trimmed,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loaded.doc.id);

  if (error) {
    console.error("rejectDocument failed", error);
    return { ok: false, error: "Couldn't record the rejection. Try again." };
  }

  await recomputeContractorStatus(supabase, loaded.contractor.id);

  let emailWarning: string | undefined;
  if (loaded.token) {
    // The email carries the upload link, so it has to leave it valid.
    await refreshTokenExpiry(supabase, loaded.contractor.id);
    const appUrl = await getAppUrl();
    const result = await sendDocumentRejectedEmail({
      to: loaded.contractor.email,
      contactName: loaded.contractor.contact_name,
      companyName: company.name,
      replyTo: user?.email ?? null,
      documentName: loaded.doc.documentName,
      reason: trimmed,
      onboardUrl: `${appUrl}/onboard/${loaded.token}`,
    });
    if (!result.ok) {
      emailWarning =
        result.reason === "not_configured"
          ? "Recorded, but the contractor wasn't emailed (email isn't configured)."
          : "Recorded, but the notification email failed to send.";
    }
  }

  revalidatePath(`/dashboard/contractors/${loaded.contractor.id}`);
  revalidatePath("/dashboard/contractors");
  revalidatePath("/dashboard");
  return { ok: true, emailWarning };
}

/**
 * Cancels a document request before the contractor has responded. Only valid
 * from "requested" — once they've uploaded something there's a real
 * submission to deal with (reject it instead), and once approved there's a
 * real record to preserve (nothing to revoke). The row stays, marked
 * "revoked", rather than being deleted — an audit trail of what was asked
 * for and then cancelled is worth more than a clean table, and
 * deriveContractorStatus already excludes revoked rows entirely (see
 * lib/contractor-status.ts), so a revoked document can never read as
 * pending, outstanding, or anything else.
 */
export async function revokeDocumentRequest(
  contractorDocumentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };

  const supabase = await createClient();
  const loaded = await loadDocForCompany(supabase, company.id, contractorDocumentId);
  if (!loaded) return { ok: false, error: "Couldn't find that document." };
  if (!canRevoke(loaded.doc.status)) {
    return {
      ok: false,
      error: "Only a document the contractor hasn't responded to yet can be revoked.",
    };
  }

  const { error } = await supabase
    .from("contractor_documents")
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", loaded.doc.id);

  if (error) {
    console.error("revokeDocumentRequest failed", error);
    return { ok: false, error: "Couldn't revoke this request. Try again." };
  }

  await recomputeContractorStatus(supabase, loaded.contractor.id);

  revalidatePath(`/dashboard/contractors/${loaded.contractor.id}`);
  revalidatePath("/dashboard/contractors");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Re-sends the request email for one document, through the same shared
 * sender as the contractor-list "Resend request" button and the checkbox
 * resend (lib/contractors/request-email.ts) — so the cooldown and link
 * expiry apply identically to all three — just scoped to this one document's
 * name instead of everything outstanding.
 *
 * Deliberately reuses the contractor's existing token rather than minting a
 * new one. Tokens in this app are per-contractor, not per-document (one link
 * covers every document requested from them, and the page it opens always
 * reflects whatever is currently outstanding — see /onboard/[token]) — so
 * rotating it here would invalidate that contractor's link for every OTHER
 * document still pending on it too, for no security benefit: the link's
 * content is resolved fresh server-side on every visit, not cached at
 * issue-time, so there's nothing "stale" about the old token that a new one
 * would fix.
 */
export async function resendDocumentRequest(
  contractorDocumentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };

  const supabase = await createClient();
  const loaded = await loadDocForCompany(supabase, company.id, contractorDocumentId);
  if (!loaded) return { ok: false, error: "Couldn't find that document." };

  // Same path as the checkbox panel, so a single-row resend behaves
  // identically to ticking that one box: any status, one email, cooldown.
  const result = await resendDocumentRequests(loaded.contractor.id, [contractorDocumentId]);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * Corrects the recorded expiry date on a document that's already approved —
 * a typo fix, not a re-review. Scoped to "approved" only, and touches
 * nothing about the file itself: the brief for this flagged the real risk
 * here ("don't let editing corrupt an approved document without a clear
 * this-replaces-it flow"), and the way this avoids that is by never editing
 * anything file-related at all. Replacing the actual file goes through
 * reject-and-reupload instead, which already has that flow.
 *
 * Runs the same recompute as approve/reject, on purpose: correcting a date
 * can flip the contractor's status either direction (fixing an accidental
 * past date un-expires them; fixing an accidental future date can expire
 * them), and both are real, correct outcomes of fixing a mistake.
 */
export async function updateApprovedDocumentExpiry(
  contractorDocumentId: string,
  expiryDate: string,
): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };

  const validity = isValidCorrectedExpiry(expiryDate);
  if (!validity.ok) {
    return { ok: false, error: validity.error };
  }

  const supabase = await createClient();
  const loaded = await loadDocForCompany(supabase, company.id, contractorDocumentId);
  if (!loaded) return { ok: false, error: "Couldn't find that document." };
  if (!canEditApprovedExpiry(loaded.doc.status)) {
    return { ok: false, error: "Only an approved document's expiry date can be edited here." };
  }

  const { error } = await supabase
    .from("contractor_documents")
    .update({ expiry_date: expiryDate, updated_at: new Date().toISOString() })
    .eq("id", loaded.doc.id);

  if (error) {
    console.error("updateApprovedDocumentExpiry failed", error);
    return { ok: false, error: "Couldn't update the expiry date. Try again." };
  }

  await recomputeContractorStatus(supabase, loaded.contractor.id);

  revalidatePath(`/dashboard/contractors/${loaded.contractor.id}`);
  revalidatePath("/dashboard/contractors");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * A short-lived link to view one uploaded file. Takes the
 * contractor_document_files row id (not the contractor_documents id) since a
 * requirement can now have several files — ownership is checked by joining
 * back up through contractor_documents -> contractors -> the caller's
 * company, the same chain the RLS policy on contractor_document_files uses.
 */
export async function getDocumentFileUrl(
  fileId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired." };

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("contractor_document_files")
    .select(
      "file_path, contractor_documents(contractor_id, contractors(company_id))",
    )
    .eq("id", fileId)
    .maybeSingle<{
      file_path: string;
      contractor_documents: {
        contractor_id: string;
        contractors: { company_id: string } | null;
      } | null;
    }>();

  const ownerCompanyId = file?.contractor_documents?.contractors?.company_id;
  if (!file || ownerCompanyId !== company.id) {
    return { ok: false, error: "No file to view." };
  }

  const { data, error } = await createSignedDownload(file.file_path, 300);
  if (error || !data) return { ok: false, error: "Couldn't open the file." };
  return { ok: true, url: data.signedUrl };
}
