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

interface LoadedDoc {
  doc: {
    id: string;
    status: string;
    file_url: string | null;
    contractor_id: string;
    documentName: string;
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
    .select("id, status, file_url, contractor_id, document_types(name)")
    .eq("id", contractorDocumentId)
    .maybeSingle<{
      id: string;
      status: string;
      file_url: string | null;
      contractor_id: string;
      document_types: { name: string } | null;
    }>();

  if (!doc) return null;

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
      file_url: doc.file_url,
      contractor_id: doc.contractor_id,
      documentName: doc.document_types?.name ?? "Document",
    },
    contractor,
    token: tokenRow?.token ?? null,
  };
}

function isValidExpiry(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxFuture = new Date(today);
  maxFuture.setFullYear(maxFuture.getFullYear() + 15);

  return date.getTime() >= today.getTime() && date.getTime() <= maxFuture.getTime();
}

export async function approveDocument(
  contractorDocumentId: string,
  expiryDate: string,
): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };
  const user = await getUser();

  if (!isValidExpiry(expiryDate)) {
    return { ok: false, error: "Enter an expiry date between today and 15 years out." };
  }

  const supabase = await createClient();
  const loaded = await loadDocForCompany(supabase, company.id, contractorDocumentId);
  if (!loaded) return { ok: false, error: "Couldn't find that document." };
  if (loaded.doc.status !== "uploaded") {
    return { ok: false, error: "This document isn't awaiting review." };
  }

  const { error } = await supabase
    .from("contractor_documents")
    .update({
      status: "approved",
      expiry_date: expiryDate,
      rejection_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loaded.doc.id);

  if (error) {
    console.error("approveDocument failed", error);
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

export async function getDocumentFileUrl(
  contractorDocumentId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired." };

  const supabase = await createClient();
  const loaded = await loadDocForCompany(supabase, company.id, contractorDocumentId);
  if (!loaded || !loaded.doc.file_url) {
    return { ok: false, error: "No file to view." };
  }

  const { data, error } = await createSignedDownload(loaded.doc.file_url, 300);
  if (error || !data) return { ok: false, error: "Couldn't open the file." };
  return { ok: true, url: data.signedUrl };
}
