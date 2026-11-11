"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/dal";
import { requireActiveCompany } from "@/lib/billing/require-active";
import { getAppUrl } from "@/lib/app-url";
import { canAddContractor, limitMessage } from "@/lib/billing/entitlements";
import { sendOnboardingEmail, type SendResult } from "@/lib/email/onboarding";
import { sendRequestToContractor } from "@/lib/contractors/request-email";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESEND_COOLDOWN_SECONDS } from "@/lib/contractor-details-logic";
import { rpcErrorMessage, subbiesRpcCode } from "@/lib/db/rpc-errors";

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
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };
  const company = access.company;
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

  // Create the contractor, its document requests and its upload link in one
  // database call (create_contractor, migration 0020). The function re-checks
  // access and the plan limit under a lock, so two tabs racing can't both slip
  // past the limit, and a direct insert from the browser is refused.
  const { data: created, error: createError } = await supabase
    .rpc("create_contractor", {
      p_business_name: businessName,
      p_contact_name: contactName || null,
      p_email: email,
      p_phone: phone || null,
      p_trade: trade || null,
      p_document_type_ids: docTypes.map((dt) => dt.id),
    })
    .single<{ contractor_id: string; token: string }>();

  if (createError || !created) {
    const code = subbiesRpcCode(createError);
    if (code === "SUBBIES_LIMIT_REACHED") {
      return { ok: false, limitReached: true, error: rpcErrorMessage(createError, "contractors") };
    }
    if (code === "SUBBIES_UNKNOWN_DOCUMENT_TYPE") {
      return { ok: false, fieldErrors: { document_type_ids: rpcErrorMessage(createError, "contractors") } };
    }
    console.error("createContractor: create_contractor failed", {
      code: createError?.code,
      message: createError?.message,
    });
    return { ok: false, error: code ? rpcErrorMessage(createError, "contractors") : "Something went wrong creating this contractor." };
  }

  // Send the onboarding email. A failure here does not undo the contractor —
  // it can be resent from the contractors list.
  const appUrl = await getAppUrl();
  const emailResult: SendResult = await sendOnboardingEmail({
    companyId: company.id,
    to: email,
    contactName: contactName || null,
    companyName: company.name,
    replyTo: user?.email ?? null,
    documentNames: docTypes.map((dt) => dt.name),
    onboardUrl: `${appUrl}/onboard/${created.token}`,
  });

  // A delivered first email starts the resend cooldown, so "Resend" straight
  // after creating doesn't send the same email twice. A failed one doesn't,
  // so the company can retry at once.
  if (emailResult.ok) {
    const { error: stampError } = await createAdminClient().rpc("claim_request_cooldown", {
      p_contractor_id: created.contractor_id,
      p_window_seconds: RESEND_COOLDOWN_SECONDS,
    });
    if (stampError) console.error("createContractor: couldn't start the resend cooldown", { code: stampError.code });
  }

  revalidatePath("/dashboard/contractors");
  revalidatePath("/dashboard");

  const params = new URLSearchParams({ created: businessName });
  if (!emailResult.ok) params.set("email", emailResult.reason);
  redirect(`/dashboard/contractors?${params.toString()}`);
}

export async function resendOnboardingRequest(
  contractorId: string,
): Promise<{ ok: boolean; message: string }> {
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, message: access.error };
  const company = access.company;
  const user = await getUser();

  const supabase = await createClient();

  const { data: contractor, error: contractorError } = await supabase
    .from("contractors")
    .select("id, business_name, contact_name, email, archived_at")
    .eq("id", contractorId)
    .eq("company_id", company.id)
    .single();

  if (contractorError || !contractor) {
    return { ok: false, message: "Couldn't find that contractor." };
  }
  if (contractor.archived_at) {
    return { ok: false, message: "This contractor is archived. Restore them before sending requests." };
  }

  // Archived documents are the company's private record and never go in an
  // email. A pending replacement IS outstanding (the contractor has been asked
  // for it), so those rows count; but the fallback list of "everything" names
  // each requirement once, so it only takes the live rows.
  const { data: docs } = await supabase
    .from("contractor_documents")
    .select("status, replaces_document_id, document_types(name)")
    .eq("contractor_id", contractor.id)
    .is("archived_at", null);

  const nameOf = (d: { document_types: unknown }) => {
    const dt = d.document_types as unknown as { name: string } | null;
    return dt?.name ?? "Document";
  };

  const outstanding = (docs ?? [])
    .filter((d) => d.status === "requested" || d.status === "rejected")
    .map(nameOf);

  const documentNames =
    outstanding.length > 0
      ? outstanding
      : (docs ?? []).filter((d) => d.replaces_document_id === null).map(nameOf);

  const result = await sendRequestToContractor(supabase, {
    companyId: company.id,
    contractor,
    companyName: company.name,
    replyTo: user?.email ?? null,
    documentNames,
  });

  if (!result.ok) return { ok: false, message: result.message };

  return { ok: true, message: `Onboarding request re-sent to ${contractor.email}.` };
}
