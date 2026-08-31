"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCompany, getUser } from "@/lib/supabase/dal";
import { getAppUrl } from "@/lib/app-url";
import { canAddContractor, limitMessage } from "@/lib/billing/entitlements";
import { sendOnboardingEmail, type SendResult } from "@/lib/email/onboarding";

export interface NewContractorState {
  ok: boolean;
  error?: string;
  limitReached?: boolean;
  fieldErrors?: {
    business_name?: string;
    contact_name?: string;
    email?: string;
    phone?: string;
    trade?: string;
    document_type_ids?: string;
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function createContractor(
  _prev: NewContractorState | null,
  formData: FormData,
): Promise<NewContractorState> {
  const company = await getCompany();
  if (!company) {
    return { ok: false, error: "Your session has expired. Reload and try again." };
  }
  const user = await getUser();

  const limitCheck = await canAddContractor(company.id);
  if (!limitCheck.allowed) {
    return {
      ok: false,
      limitReached: true,
      error: limitMessage(limitCheck, "contractors"),
    };
  }

  const businessName = str(formData, "business_name");
  const contactName = str(formData, "contact_name");
  const email = str(formData, "email").toLowerCase();
  const phone = str(formData, "phone");
  const trade = str(formData, "trade");
  const documentTypeIds = formData
    .getAll("document_type_ids")
    .map((v) => String(v))
    .filter(Boolean);

  const fieldErrors: NewContractorState["fieldErrors"] = {};
  if (!businessName) fieldErrors.business_name = "Enter the contractor's business name.";
  else if (businessName.length > 120) fieldErrors.business_name = "Keep this under 120 characters.";
  if (contactName.length > 120) fieldErrors.contact_name = "Keep this under 120 characters.";
  if (!email) fieldErrors.email = "Enter an email address for the onboarding link.";
  else if (!EMAIL_RE.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (phone.length > 40) fieldErrors.phone = "Keep this under 40 characters.";
  if (trade.length > 80) fieldErrors.trade = "Keep this under 80 characters.";
  if (documentTypeIds.length === 0)
    fieldErrors.document_type_ids = "Select at least one document to request.";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const supabase = await createClient();

  // Confirm every selected document type belongs to this company.
  const { data: docTypes, error: docTypesError } = await supabase
    .from("document_types")
    .select("id, name")
    .eq("company_id", company.id)
    .in("id", documentTypeIds);

  if (docTypesError) {
    console.error("createContractor: document type check failed", docTypesError);
    return { ok: false, error: "Something went wrong. Try again." };
  }
  if (!docTypes || docTypes.length !== documentTypeIds.length) {
    return {
      ok: false,
      fieldErrors: { document_type_ids: "One of the selected documents is no longer available. Refresh and try again." },
    };
  }

  // Create the contractor.
  const { data: contractor, error: contractorError } = await supabase
    .from("contractors")
    .insert({
      company_id: company.id,
      business_name: businessName,
      contact_name: contactName || null,
      email,
      phone: phone || null,
      trade: trade || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (contractorError || !contractor) {
    console.error("createContractor: insert failed", contractorError);
    return { ok: false, error: "Something went wrong creating this contractor." };
  }

  // Create the requested document rows and the access token. If either fails,
  // roll back the contractor so we don't leave a half-built record.
  const { error: docsError } = await supabase.from("contractor_documents").insert(
    docTypes.map((dt) => ({
      contractor_id: contractor.id,
      document_type_id: dt.id,
      status: "requested" as const,
    })),
  );

  const { data: tokenRow, error: tokenError } = await supabase
    .from("contractor_tokens")
    .insert({ contractor_id: contractor.id })
    .select("token")
    .single();

  if (docsError || tokenError || !tokenRow) {
    console.error("createContractor: follow-up insert failed", docsError, tokenError);
    await supabase.from("contractors").delete().eq("id", contractor.id).eq("company_id", company.id);
    return { ok: false, error: "Something went wrong setting up the document request. Try again." };
  }

  // Send the onboarding email. A failure here does not undo the contractor —
  // it can be resent from the contractors list.
  const appUrl = await getAppUrl();
  const emailResult: SendResult = await sendOnboardingEmail({
    to: email,
    contactName: contactName || null,
    companyName: company.name,
    replyTo: user?.email ?? null,
    documentNames: docTypes.map((dt) => dt.name),
    onboardUrl: `${appUrl}/onboard/${tokenRow.token}`,
  });

  revalidatePath("/dashboard/contractors");
  revalidatePath("/dashboard");

  const params = new URLSearchParams({ created: businessName });
  if (!emailResult.ok) params.set("email", emailResult.reason);
  redirect(`/dashboard/contractors?${params.toString()}`);
}

export async function resendOnboardingRequest(
  contractorId: string,
): Promise<{ ok: boolean; message: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, message: "Your session has expired. Reload and try again." };
  const user = await getUser();

  const supabase = await createClient();

  const { data: contractor, error: contractorError } = await supabase
    .from("contractors")
    .select("id, business_name, contact_name, email")
    .eq("id", contractorId)
    .eq("company_id", company.id)
    .single();

  if (contractorError || !contractor) {
    return { ok: false, message: "Couldn't find that contractor." };
  }

  const { data: tokenRow } = await supabase
    .from("contractor_tokens")
    .select("token")
    .eq("contractor_id", contractor.id)
    .single();

  if (!tokenRow) {
    return { ok: false, message: "This contractor has no active link. Contact support." };
  }

  const { data: docs } = await supabase
    .from("contractor_documents")
    .select("status, document_types(name)")
    .eq("contractor_id", contractor.id);

  const outstanding = (docs ?? [])
    .filter((d) => d.status === "requested" || d.status === "rejected")
    .map((d) => {
      const dt = d.document_types as unknown as { name: string } | null;
      return dt?.name ?? "Document";
    });

  const documentNames =
    outstanding.length > 0
      ? outstanding
      : (docs ?? []).map((d) => {
          const dt = d.document_types as unknown as { name: string } | null;
          return dt?.name ?? "Document";
        });

  const appUrl = await getAppUrl();
  const result = await sendOnboardingEmail({
    to: contractor.email,
    contactName: contractor.contact_name,
    companyName: company.name,
    replyTo: user?.email ?? null,
    documentNames,
    onboardUrl: `${appUrl}/onboard/${tokenRow.token}`,
  });

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "not_configured"
          ? "Email isn't configured yet, so the request couldn't be sent."
          : "The email service rejected the request. Try again shortly.",
    };
  }

  return { ok: true, message: `Onboarding request re-sent to ${contractor.email}.` };
}
