import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ContractorDocument, DocumentStatus } from "@/lib/types";

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

export interface OnboardingChecklistItem {
  id: string;
  documentName: string;
  status: DocumentStatus;
  rejectionReason: string | null;
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
    .eq("contractor_id", contractor.id);

  if (docsError) return null;

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
