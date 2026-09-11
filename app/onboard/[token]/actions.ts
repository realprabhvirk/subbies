"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOnboardingToken, getCompanyOwnerEmail } from "@/lib/onboarding";
import { getAppUrl } from "@/lib/app-url";
import { recomputeContractorStatus } from "@/lib/contractor-status";
import { sendDocumentSubmittedEmail } from "@/lib/email/company";
import {
  MAX_UPLOAD_BYTES,
  isAllowedMimeType,
  buildDocumentPath,
  createSignedUpload,
  createSignedDownload,
  getObjectInfo,
  deleteObject,
} from "@/lib/storage";
import { canSubmitDocument, MAX_FILES_PER_SUBMISSION } from "@/lib/document-actions-logic";
import type { DocumentStatus } from "@/lib/types";

interface DocRow {
  id: string;
  contractor_id: string;
  status: DocumentStatus;
  document_types: { name: string } | null;
}

async function loadOwnedDocument(
  contractorId: string,
  contractorDocumentId: string,
): Promise<DocRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("contractor_documents")
    .select("id, contractor_id, status, document_types(name)")
    .eq("id", contractorDocumentId)
    .maybeSingle<DocRow>();

  if (!data || data.contractor_id !== contractorId) return null;
  return data;
}

export type RequestUploadResult =
  | { ok: true; path: string; signedUrl: string; uploadToken: string }
  | { ok: false; error: string };

/** Issues a signed upload URL for one staged file. Called once per file. */
export async function requestDocumentUpload(
  token: string,
  contractorDocumentId: string,
  file: { name: string; type: string; size: number },
): Promise<RequestUploadResult> {
  const resolved = await resolveOnboardingToken(token);
  if (!resolved) return { ok: false, error: "This upload link is no longer valid." };

  const doc = await loadOwnedDocument(resolved.contractorId, contractorDocumentId);
  if (!doc) return { ok: false, error: "That document isn't part of this request." };
  if (!canSubmitDocument(doc.status)) {
    return { ok: false, error: "This document has already been submitted." };
  }

  if (!isAllowedMimeType(file.type)) {
    return {
      ok: false,
      error: "Upload a PDF, JPG, PNG, or HEIC file.",
    };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "That file is over the 15 MB limit." };
  }

  const path = buildDocumentPath({
    companyId: resolved.companyId,
    contractorId: resolved.contractorId,
    contractorDocumentId: doc.id,
    mime: file.type,
  });

  const { data, error } = await createSignedUpload(path);
  if (error || !data) {
    console.error("requestDocumentUpload: signed url failed", error);
    return { ok: false, error: "Couldn't start the upload. Try again." };
  }

  return {
    ok: true,
    path: data.path,
    signedUrl: data.signedUrl,
    uploadToken: data.token,
  };
}

export type SubmitStagedResult = { ok: boolean; error?: string };

/**
 * Confirms a whole batch of already-uploaded files (their bytes are already
 * sitting in Storage via requestDocumentUpload + a direct browser upload —
 * this is the one call that actually registers them against the document
 * requirement, once the contractor hits the real "Submit" button) and marks
 * the requirement submitted.
 *
 * Replaces whatever files (if any) this requirement already had, the same
 * way a single-file replace always has — a resubmission is "here is the
 * complete, current set of files for this", not an addition to a growing
 * pile every time something gets fixed and resent.
 */
export async function submitStagedDocuments(
  token: string,
  contractorDocumentId: string,
  files: { path: string; fileName: string }[],
): Promise<SubmitStagedResult> {
  const resolved = await resolveOnboardingToken(token);
  if (!resolved) return { ok: false, error: "This upload link is no longer valid." };

  if (files.length === 0) {
    return { ok: false, error: "Add at least one file before submitting." };
  }
  if (files.length > MAX_FILES_PER_SUBMISSION) {
    return { ok: false, error: `Submit up to ${MAX_FILES_PER_SUBMISSION} files at a time.` };
  }

  const doc = await loadOwnedDocument(resolved.contractorId, contractorDocumentId);
  if (!doc) return { ok: false, error: "That document isn't part of this request." };
  if (!canSubmitDocument(doc.status)) {
    return { ok: false, error: "This document has already been submitted." };
  }

  const expectedPrefix = `${resolved.companyId}/${resolved.contractorId}/${doc.id}/`;

  // Verify every file against its real stored object before touching the
  // database — the same defense the single-file flow always applied,
  // repeated per file. Any one bad file fails the whole batch: a partial
  // submission (2 of 3 files registered) would be a confusing thing for the
  // contractor to land back on and re-attempt.
  for (const f of files) {
    if (!f.path.startsWith(expectedPrefix)) {
      return { ok: false, error: "Upload path mismatch. Try again." };
    }
    const info = await getObjectInfo(f.path);
    if (!info) {
      return { ok: false, error: "We couldn't find one of the uploaded files. Try again." };
    }
    if (
      (info.mimetype && !isAllowedMimeType(info.mimetype)) ||
      (info.size != null && info.size > MAX_UPLOAD_BYTES)
    ) {
      await deleteObject(f.path);
      return { ok: false, error: "One of those files isn't an accepted type or size." };
    }
  }

  const admin = createAdminClient();

  // Replace whatever was there before.
  const { data: existingFiles } = await admin
    .from("contractor_document_files")
    .select("id, file_path")
    .eq("contractor_document_id", doc.id);

  for (const old of existingFiles ?? []) {
    await deleteObject(old.file_path);
  }
  if (existingFiles && existingFiles.length > 0) {
    await admin
      .from("contractor_document_files")
      .delete()
      .eq("contractor_document_id", doc.id);
  }

  const { error: insertError } = await admin.from("contractor_document_files").insert(
    files.map((f) => ({
      contractor_document_id: doc.id,
      file_path: f.path,
      file_name: f.fileName,
    })),
  );
  if (insertError) {
    console.error("submitStagedDocuments: file insert failed", insertError);
    return { ok: false, error: "Couldn't save the upload. Try again." };
  }

  const { error: updateError } = await admin
    .from("contractor_documents")
    // file_url kept as a legacy mirror of the first file — nothing new reads
    // it, but nothing has to change to keep it accurate either.
    .update({
      status: "uploaded",
      file_url: files[0].path,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", doc.id);

  if (updateError) {
    console.error("submitStagedDocuments: status update failed", updateError);
    return { ok: false, error: "Couldn't save the upload. Try again." };
  }

  await recomputeContractorStatus(admin, resolved.contractorId);

  const documentName = doc.document_types?.name ?? "A document";

  await admin.from("notifications").insert({
    company_id: resolved.companyId,
    contractor_id: resolved.contractorId,
    type: "document_uploaded",
    message: `${resolved.businessName} uploaded ${documentName}`,
  });

  // Best-effort email to the company.
  const ownerEmail = await getCompanyOwnerEmail(resolved.companyId);
  if (ownerEmail) {
    const appUrl = await getAppUrl();
    await sendDocumentSubmittedEmail({
      to: ownerEmail,
      contractorName: resolved.businessName,
      documentNames: [documentName],
      reviewUrl: `${appUrl}/dashboard/contractors/${resolved.contractorId}`,
    });
  }

  revalidatePath(`/onboard/${token}`);
  return { ok: true };
}

/** A short-lived link the contractor can use to view a file they submitted. */
export async function getSubmittedFileUrl(
  token: string,
  fileId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const resolved = await resolveOnboardingToken(token);
  if (!resolved) return { ok: false, error: "This link is no longer valid." };

  const admin = createAdminClient();
  const { data: file } = await admin
    .from("contractor_document_files")
    .select("file_path, contractor_documents(contractor_id)")
    .eq("id", fileId)
    .maybeSingle<{
      file_path: string;
      contractor_documents: { contractor_id: string } | null;
    }>();

  if (!file || file.contractor_documents?.contractor_id !== resolved.contractorId) {
    return { ok: false, error: "No file to view." };
  }

  const { data, error } = await createSignedDownload(file.file_path, 120);
  if (error || !data) return { ok: false, error: "Couldn't open the file." };
  return { ok: true, url: data.signedUrl };
}
