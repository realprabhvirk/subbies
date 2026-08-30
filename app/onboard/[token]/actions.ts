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

interface DocRow {
  id: string;
  contractor_id: string;
  status: string;
  file_url: string | null;
  document_types: { name: string } | null;
}

async function loadOwnedDocument(
  contractorId: string,
  contractorDocumentId: string,
): Promise<DocRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("contractor_documents")
    .select("id, contractor_id, status, file_url, document_types(name)")
    .eq("id", contractorDocumentId)
    .maybeSingle<DocRow>();

  if (!data || data.contractor_id !== contractorId) return null;
  return data;
}

export type RequestUploadResult =
  | { ok: true; path: string; signedUrl: string; uploadToken: string }
  | { ok: false; error: string };

export async function requestDocumentUpload(
  token: string,
  contractorDocumentId: string,
  file: { name: string; type: string; size: number },
): Promise<RequestUploadResult> {
  const resolved = await resolveOnboardingToken(token);
  if (!resolved) return { ok: false, error: "This upload link is no longer valid." };

  const doc = await loadOwnedDocument(resolved.contractorId, contractorDocumentId);
  if (!doc) return { ok: false, error: "That document isn't part of this request." };
  if (doc.status !== "requested" && doc.status !== "rejected") {
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

export type ConfirmUploadResult = { ok: boolean; error?: string };

export async function confirmDocumentUpload(
  token: string,
  contractorDocumentId: string,
  path: string,
): Promise<ConfirmUploadResult> {
  const resolved = await resolveOnboardingToken(token);
  if (!resolved) return { ok: false, error: "This upload link is no longer valid." };

  const doc = await loadOwnedDocument(resolved.contractorId, contractorDocumentId);
  if (!doc) return { ok: false, error: "That document isn't part of this request." };

  const expectedPrefix = `${resolved.companyId}/${resolved.contractorId}/${doc.id}/`;
  if (!path.startsWith(expectedPrefix)) {
    return { ok: false, error: "Upload path mismatch. Try again." };
  }

  const info = await getObjectInfo(path);
  if (!info) {
    return { ok: false, error: "We couldn't find the uploaded file. Try again." };
  }
  if (
    (info.mimetype && !isAllowedMimeType(info.mimetype)) ||
    (info.size != null && info.size > MAX_UPLOAD_BYTES)
  ) {
    await deleteObject(path);
    return { ok: false, error: "That file type or size isn't accepted." };
  }

  const admin = createAdminClient();

  // Replace any previous file for this document.
  if (doc.file_url && doc.file_url !== path) {
    await deleteObject(doc.file_url);
  }

  const { error: updateError } = await admin
    .from("contractor_documents")
    .update({
      status: "uploaded",
      file_url: path,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", doc.id);

  if (updateError) {
    console.error("confirmDocumentUpload: update failed", updateError);
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
  contractorDocumentId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const resolved = await resolveOnboardingToken(token);
  if (!resolved) return { ok: false, error: "This link is no longer valid." };

  const doc = await loadOwnedDocument(resolved.contractorId, contractorDocumentId);
  if (!doc || !doc.file_url) return { ok: false, error: "No file to view." };

  const { data, error } = await createSignedDownload(doc.file_url, 120);
  if (error || !data) return { ok: false, error: "Couldn't open the file." };
  return { ok: true, url: data.signedUrl };
}
