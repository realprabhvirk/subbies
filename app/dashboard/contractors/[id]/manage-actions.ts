"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompany, getUser } from "@/lib/supabase/dal";
import { deleteContractorFiles } from "@/lib/storage";
import {
  sendRequestToContractor,
  disableUploadLink,
} from "@/lib/contractors/request-email";
import {
  formatAbn,
  isMissingColumnError,
  selectResendable,
  validateContractorDetails,
  type ContractorDetailsFieldErrors,
  type ContractorDetailsInput,
} from "@/lib/contractor-details-logic";
import { canResendRequest } from "@/lib/document-actions-logic";
import type { DocumentStatus } from "@/lib/types";

const SESSION_EXPIRED = "Your session has expired. Reload and try again.";

function revalidateContractor(contractorId: string) {
  revalidatePath(`/dashboard/contractors/${contractorId}`);
  revalidatePath("/dashboard/contractors");
  revalidatePath("/dashboard");
}

// --- edit details -----------------------------------------------------------

export type UpdateDetailsResult =
  | { ok: true; saved: ContractorDetailsInput }
  | { ok: false; error?: string; fieldErrors?: ContractorDetailsFieldErrors };

/**
 * Saves edits to a contractor's contact and business details.
 *
 * The validation is re-run here as the real gate — the form runs the same
 * function for instant feedback, but a request can arrive from anywhere. The
 * write is scoped by `company_id` as well as `id`, on top of RLS: a contractor
 * id belonging to another company matches no row, and comes back as "couldn't
 * find that contractor" rather than as a permission error, so the response
 * never confirms that someone else's contractor exists.
 */
export async function updateContractorDetails(
  contractorId: string,
  input: ContractorDetailsInput,
): Promise<UpdateDetailsResult> {
  const company = await getCompany();
  if (!company) return { ok: false, error: SESSION_EXPIRED };
  if (typeof contractorId !== "string" || !contractorId) {
    return { ok: false, error: "Couldn't find that contractor." };
  }

  const validation = validateContractorDetails(input ?? ({} as ContractorDetailsInput));
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractors")
    .update(validation.data)
    .eq("id", contractorId)
    .eq("company_id", company.id)
    .select("id");

  if (error) {
    console.error("updateContractorDetails failed", { code: error.code, message: error.message });
    if (error.code === "23514") {
      return { ok: false, fieldErrors: { abn: "An ABN is 11 digits, e.g. 12 345 678 901." } };
    }
    if (isMissingColumnError(error)) {
      return {
        ok: false,
        error: "Saving isn't available yet: a pending database update hasn't been applied.",
      };
    }
    return { ok: false, error: "Couldn't save your changes. Try again." };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "Couldn't find that contractor." };
  }

  revalidateContractor(contractorId);
  return {
    ok: true,
    saved: {
      businessName: validation.data.business_name,
      contactName: validation.data.contact_name ?? "",
      email: validation.data.email,
      phone: validation.data.phone ?? "",
      abn: formatAbn(validation.data.abn),
    },
  };
}

// --- delete -----------------------------------------------------------------

export type DeleteContractorResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

/**
 * Permanently deletes a contractor and everything under them.
 *
 * Order matters, and each step is chosen so that stopping at any point leaves
 * something recoverable rather than something broken:
 *
 *  1. Confirm the caller owns this contractor. Nothing has changed yet.
 *  2. Disable the upload link, so nothing new can arrive through it while
 *     the files are being removed. It is expired rather than deleted, so if a
 *     later step fails the contractor still exists and a resend brings the
 *     link back.
 *  3. Remove their files from Storage. If ANY can't be removed — or the
 *     listing itself fails — stop here and delete nothing else. The database
 *     rows are the only record of what belongs to whom, so removing them
 *     first and then failing on the files would leave objects nothing points
 *     at. A failed delete is safe to retry: this step is idempotent.
 *  4. Delete the contractor row. Documents, file records, the link, project
 *     assignments, notifications and the reminder log all cascade off it.
 *
 * Hard delete, not soft: a soft-deleted contractor keeps its files counting
 * against the storage cap and keeps personal data the company asked to have
 * gone.
 */
export async function deleteContractor(
  contractorId: string,
): Promise<DeleteContractorResult> {
  const company = await getCompany();
  if (!company) return { ok: false, error: SESSION_EXPIRED };
  if (typeof contractorId !== "string" || !contractorId) {
    return { ok: false, error: "Couldn't find that contractor." };
  }

  const supabase = await createClient();

  // 1. Ownership.
  const { data: contractor } = await supabase
    .from("contractors")
    .select("id, business_name")
    .eq("id", contractorId)
    .eq("company_id", company.id)
    .maybeSingle<{ id: string; business_name: string }>();

  if (!contractor) return { ok: false, error: "Couldn't find that contractor." };

  // 2. Cut off the link before touching anything irreversible.
  if (!(await disableUploadLink(supabase, contractor.id))) {
    return {
      ok: false,
      error: `Couldn't disable ${contractor.business_name}'s upload link, so nothing was deleted. Try again.`,
    };
  }

  // 3. Their files.
  const files = await deleteContractorFiles(company.id, contractor.id);
  if (files.listFailed || files.failedPaths.length > 0) {
    console.error("deleteContractor: files could not be fully removed, aborting", {
      contractorId: contractor.id,
      listFailed: files.listFailed,
      failed: files.failedPaths.length,
    });
    return {
      ok: false,
      error: `We couldn't remove all of ${contractor.business_name}'s files, so the contractor was not deleted. Their upload link is switched off. Try again.`,
    };
  }

  // 4. The contractor itself.
  const { data: deleted, error } = await supabase
    .from("contractors")
    .delete()
    .eq("id", contractor.id)
    .eq("company_id", company.id)
    .select("id");

  if (error || !deleted || deleted.length === 0) {
    console.error("deleteContractor: row delete failed", {
      contractorId: contractor.id,
      code: error?.code,
      message: error?.message,
    });
    return {
      ok: false,
      error: `Their files were removed but ${contractor.business_name} couldn't be deleted. Try again.`,
    };
  }

  revalidateContractor(contractor.id);
  return { ok: true, name: contractor.business_name };
}

// --- resend requests --------------------------------------------------------

export type ResendRequestsResult =
  | { ok: true; sentTo: string; count: number }
  | { ok: false; error: string };

/**
 * Sends ONE email to the contractor covering the selected documents.
 *
 * The selection is checked against this contractor's own documents that are
 * actually waiting on them (requested or rejected) — built server-side, so an
 * id that belongs to a different contractor or company, or to a document that
 * has since been approved, is simply not in the set and the request is
 * refused. Nothing the client sends decides who gets emailed or what the
 * email says.
 *
 * The link in the email is the contractor's existing one, with its expiry
 * extended, and opens the page listing everything currently outstanding for
 * them — not just the documents named in this email. Rotating the link
 * instead would kill it in every earlier email they're still holding.
 */
export async function resendDocumentRequests(
  contractorId: string,
  documentIds: string[],
): Promise<ResendRequestsResult> {
  const company = await getCompany();
  if (!company) return { ok: false, error: SESSION_EXPIRED };
  const user = await getUser();

  if (typeof contractorId !== "string" || !contractorId) {
    return { ok: false, error: "Couldn't find that contractor." };
  }

  const supabase = await createClient();

  const { data: contractor } = await supabase
    .from("contractors")
    .select("id, business_name, contact_name, email")
    .eq("id", contractorId)
    .eq("company_id", company.id)
    .maybeSingle<{
      id: string;
      business_name: string;
      contact_name: string | null;
      email: string;
    }>();

  if (!contractor) return { ok: false, error: "Couldn't find that contractor." };

  const { data: docs, error: docsError } = await supabase
    .from("contractor_documents")
    .select("id, status, document_types(name)")
    .eq("contractor_id", contractor.id);

  if (docsError) {
    console.error("resendDocumentRequests: document lookup failed", docsError);
    return { ok: false, error: "Couldn't load this contractor's documents. Try again." };
  }

  const rows = (docs ?? []) as unknown as {
    id: string;
    status: DocumentStatus;
    document_types: { name: string } | null;
  }[];
  const eligible = rows.filter((d) => canResendRequest(d.status));

  const selection = selectResendable(
    documentIds,
    eligible.map((d) => d.id),
  );
  if (!selection.ok) return { ok: false, error: selection.error };

  const chosen = new Set(selection.ids);
  const documentNames = eligible
    .filter((d) => chosen.has(d.id))
    .map((d) => d.document_types?.name ?? "Document")
    .sort((a, b) => a.localeCompare(b));

  const result = await sendRequestToContractor(supabase, {
    contractor,
    companyName: company.name,
    replyTo: user?.email ?? null,
    documentNames,
  });

  if (!result.ok) return { ok: false, error: result.message };

  revalidateContractor(contractor.id);
  return { ok: true, sentTo: contractor.email, count: documentNames.length };
}
