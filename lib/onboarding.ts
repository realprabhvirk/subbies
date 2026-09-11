import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ContractorDocument, DocumentStatus } from "@/lib/types";
import { groupFilesByDocument } from "@/lib/document-files-logic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export interface ResolvedToken {
  contractorId: string;
  companyId: string;
  companyName: string;
  businessName: string;
  contactName: string | null;
  contractorEmail: string;
}

/**
 * Trusted server-side resolution of a contractor token to the ids and contact
 * details the upload actions need. Returns null for a missing/malformed token.
 */
export async function resolveOnboardingToken(
  token: string,
): Promise<ResolvedToken | null> {
  if (!token || !UUID_RE.test(token)) return null;

  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("contractor_tokens")
    .select("contractor_id")
    .eq("token", token)
    .maybeSingle<{ contractor_id: string }>();

  if (!tokenRow) return null;

  const { data: contractor } = await admin
    .from("contractors")
    .select("id, company_id, business_name, contact_name, email, companies(name)")
    .eq("id", tokenRow.contractor_id)
    .maybeSingle<{
      id: string;
      company_id: string;
      business_name: string;
      contact_name: string | null;
      email: string;
      companies: { name: string } | null;
    }>();

  if (!contractor) return null;

  return {
    contractorId: contractor.id,
    companyId: contractor.company_id,
    companyName: contractor.companies?.name ?? "The company",
    businessName: contractor.business_name,
    contactName: contractor.contact_name,
    contractorEmail: contractor.email,
  };
}

/** The auth email of the company account owner (for company-facing emails). */
export async function getCompanyOwnerEmail(
  companyId: string,
): Promise<string | null> {
  const admin = createAdminClient();

  const { data: company } = await admin
    .from("companies")
    .select("user_id")
    .eq("id", companyId)
    .maybeSingle<{ user_id: string }>();

  if (!company) return null;

  const { data, error } = await admin.auth.admin.getUserById(company.user_id);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

export interface OnboardingChecklistFile {
  id: string;
  fileName: string | null;
}

export interface OnboardingChecklistItem {
  id: string;
  documentName: string;
  status: DocumentStatus;
  rejectionReason: string | null;
  files: OnboardingChecklistFile[];
}

export interface OnboardingContext {
  contractor: {
    id: string;
    businessName: string;
    contactName: string | null;
  };
  companyName: string;
  items: OnboardingChecklistItem[];
}

/**
 * Resolves a contractor onboarding token to everything the public upload page
 * needs. Returns null for a missing or malformed token.
 *
 * This is the trusted server-side gate for the token-based flow: it validates
 * the token itself, then uses the service-role client. RLS is intentionally
 * bypassed here because there is no authenticated user.
 */
export async function getOnboardingContext(
  token: string,
): Promise<OnboardingContext | null> {
  if (!token || !UUID_RE.test(token)) return null;

  const admin = createAdminClient();

  const { data: tokenRow, error: tokenError } = await admin
    .from("contractor_tokens")
    .select("contractor_id")
    .eq("token", token)
    .maybeSingle<{ contractor_id: string }>();

  if (tokenError || !tokenRow) return null;

  const { data: contractor, error: contractorError } = await admin
    .from("contractors")
    .select("id, business_name, contact_name, company_id, companies(name)")
    .eq("id", tokenRow.contractor_id)
    .maybeSingle<{
      id: string;
      business_name: string;
      contact_name: string | null;
      company_id: string;
      companies: { name: string } | null;
    }>();

  if (contractorError || !contractor) return null;

  const { data: docs, error: docsError } = await admin
    .from("contractor_documents")
    .select("id, status, rejection_reason, document_types(name)")
    // A revoked request is cancelled — the contractor has nothing to act on
    // and shouldn't see it at all, as if it had never been asked for.
    .eq("contractor_id", contractor.id)
    .neq("status", "revoked");

  // This is the actual gate: does the token resolve to a real contractor
  // with real document requirements. A failure here is genuinely fatal —
  // there's nothing to show — so it's the one query in this function
  // allowed to turn into "the link is invalid".
  if (docsError) {
    console.error("getOnboardingContext: documents query failed", docsError);
    return null;
  }

  // The list of already-uploaded files per document is fetched separately,
  // deliberately, and its failure is never allowed to fail the function
  // above it. A join here that comes back empty or errors just means the
  // checklist renders without filenames on already-submitted documents —
  // annoying, not "this contractor's entire upload link is broken". Keeping
  // it as a second query (rather than embedding contractor_document_files
  // in the select above) is what makes that separation possible: an embed
  // failure poisons the whole query's result, a separate query's failure
  // only poisons its own.
  const docIds = (docs ?? []).map((d) => d.id);
  let filesByDoc = new Map<string, OnboardingChecklistFile[]>();
  if (docIds.length > 0) {
    const { data: files, error: filesError } = await admin
      .from("contractor_document_files")
      .select("id, file_name, contractor_document_id")
      .in("contractor_document_id", docIds);

    if (filesError) {
      console.error(
        "getOnboardingContext: file list query failed, showing the checklist without filenames",
        filesError,
      );
    } else {
      filesByDoc = groupFilesByDocument(files ?? []);
    }
  }

  const items: OnboardingChecklistItem[] = (docs ?? [])
    .map((d) => {
      const row = d as unknown as Pick<
        ContractorDocument,
        "id" | "status" | "rejection_reason"
      > & { document_types: { name: string } | null };
      return {
        id: row.id,
        documentName: row.document_types?.name ?? "Document",
        status: row.status,
        rejectionReason: row.rejection_reason,
        files: filesByDoc.get(row.id) ?? [],
      };
    })
    .sort((a, b) => a.documentName.localeCompare(b.documentName));

  return {
    contractor: {
      id: contractor.id,
      businessName: contractor.business_name,
      contactName: contractor.contact_name,
    },
    companyName: contractor.companies?.name ?? "The company",
    items,
  };
}
