import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ContractorDocument, DocumentStatus } from "@/lib/types";
import { groupFilesByDocument } from "@/lib/document-files-logic";
import { isMissingColumnError, isTokenExpired } from "@/lib/contractor-details-logic";

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
 * Finds the contractor a token belongs to, or null if the token is unknown or
 * past its expiry. Shared by both entry points below so "is this link still
 * valid" is decided in exactly one place.
 *
 * `expires_at` was added after links already existed, so this must keep
 * working on a deploy that lands before that migration has run. Reading a
 * column that isn't there is an error, and an error here would make EVERY
 * contractor's link read as invalid — the wrong way for a public page to fail
 * — so a missing-column error falls back to the old, expiry-less lookup.
 */
async function lookupToken(
  admin: ReturnType<typeof createAdminClient>,
  token: string,
): Promise<{ contractorId: string } | null> {
  interface Row {
    contractor_id: string;
    expires_at?: string | null;
  }

  let { data, error } = await admin
    .from("contractor_tokens")
    .select("contractor_id, expires_at")
    .eq("token", token)
    .maybeSingle<Row>();

  if (error && isMissingColumnError(error)) {
    ({ data, error } = await admin
      .from("contractor_tokens")
      .select("contractor_id")
      .eq("token", token)
      .maybeSingle<Row>());
  }

  if (error) {
    console.error("lookupToken failed", { code: error.code, message: error.message });
    return null;
  }
  if (!data) return null;
  if (isTokenExpired(data.expires_at)) return null;

  return { contractorId: data.contractor_id };
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

  const tokenRow = await lookupToken(admin, token);
  if (!tokenRow) return null;

  const { data: contractor } = await admin
    .from("contractors")
    .select("id, company_id, business_name, contact_name, email, companies(name)")
    .eq("id", tokenRow.contractorId)
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
  /**
   * The company asked for an updated copy of something already on file. Shown
   * so the contractor isn't left wondering why a document they've already
   * supplied is back on their list.
   */
  isReplacement: boolean;
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

  const tokenRow = await lookupToken(admin, token);
  if (!tokenRow) return null;

  const { data: contractor, error: contractorError } = await admin
    .from("contractors")
    .select("id, business_name, contact_name, company_id, companies(name)")
    .eq("id", tokenRow.contractorId)
    .maybeSingle<{
      id: string;
      business_name: string;
      contact_name: string | null;
      company_id: string;
      companies: { name: string } | null;
    }>();

  if (contractorError || !contractor) return null;

  const { data: allDocs, error: docsError } = await admin
    .from("contractor_documents")
    .select("id, status, rejection_reason, replaces_document_id, document_types(name)")
    // A revoked request is cancelled — the contractor has nothing to act on
    // and shouldn't see it at all, as if it had never been asked for.
    .eq("contractor_id", contractor.id)
    .neq("status", "revoked")
    // An archived document is the company's private record. It must never
    // reach this page, however it got archived.
    .is("archived_at", null);

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
  // When the company has asked for an updated copy of an approved document,
  // the contractor's requirement IS that new request. The approved original
  // stays valid on the company's side, but listing it here too would show the
  // same document twice, one of them already "done".
  const replacedIds = new Set(
    (allDocs ?? [])
      .map((d) => (d as unknown as { replaces_document_id: string | null }).replaces_document_id)
      .filter((id): id is string => id !== null),
  );
  const docs = (allDocs ?? []).filter((d) => !replacedIds.has(d.id));

  const docIds = docs.map((d) => d.id);
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

  const items: OnboardingChecklistItem[] = docs
    .map((d) => {
      const row = d as unknown as Pick<
        ContractorDocument,
        "id" | "status" | "rejection_reason"
      > & {
        document_types: { name: string } | null;
        replaces_document_id: string | null;
      };
      return {
        id: row.id,
        documentName: row.document_types?.name ?? "Document",
        status: row.status,
        rejectionReason: row.rejection_reason,
        files: filesByDoc.get(row.id) ?? [],
        isReplacement: row.replaces_document_id !== null,
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
