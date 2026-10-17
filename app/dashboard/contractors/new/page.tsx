import type { Metadata } from "next";
import { FileText, Lock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { canAddContractor } from "@/lib/billing/entitlements";
import type { DocumentType } from "@/lib/types";
import { ButtonLink } from "@/app/components/button";
import { EmptyState } from "@/app/components/empty-state";
import { PageHeader } from "@/app/components/page-header";
import { NewContractorForm } from "./_components/new-contractor-form";

export const metadata: Metadata = { title: "Add contractor" };

export default async function NewContractorPage() {
  const company = await getCompany();
  if (!company) return null;

  const supabase = await createClient();
  // Independent of each other.
  const limitCheckPromise = canAddContractor(company.id);
  const { data, error } = await supabase
    .from("document_types")
    .select(
      "id, company_id, name, default_duration_months, reminder_days, created_at",
    )
    .eq("company_id", company.id)
    .order("name", { ascending: true });

  const documentTypes = (data ?? []) as DocumentType[];
  const limitCheck = await limitCheckPromise;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/dashboard/contractors", label: "Contractors" }}
        title="Add contractor"
        description="Enter their details, choose which documents to request, and we'll email them a secure upload link."
      />

      {!limitCheck.allowed ? (
        <EmptyState
          icon={Lock}
          title={`You're at your plan's limit of ${limitCheck.limit} contractors`}
          description="Upgrade your plan to add more. Your existing contractors and their documents aren't affected."
          action={
            <ButtonLink href="/dashboard/settings?tab=billing">
              Go to billing
            </ButtonLink>
          }
        />
      ) : error ? (
        <p className="rounded-md border border-expired-line bg-expired-bg/70 px-4 py-3 text-sm text-expired">
          We couldn&apos;t load your document types. Refresh to try again.
        </p>
      ) : documentTypes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Add document types first"
          description="You need at least one document type before you can request documents from a contractor."
          action={
            <ButtonLink href="/dashboard/document-types">
              Go to document types
            </ButtonLink>
          }
        />
      ) : (
        <NewContractorForm documentTypes={documentTypes} />
      )}
    </div>
  );
}
