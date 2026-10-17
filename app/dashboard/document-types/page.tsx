import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { PageHeader } from "@/app/components/page-header";
import { canAddDocumentType } from "@/lib/billing/entitlements";
import type { DocumentType } from "@/lib/types";
import { DocumentTypesManager } from "./_components/document-types-manager";

export const metadata: Metadata = { title: "Document types" };

export default async function DocumentTypesPage() {
  const company = await getCompany();
  if (!company) return null;

  const supabase = await createClient();
  // Independent of each other: the limit check never reads the list.
  const limitCheckPromise = canAddDocumentType(company.id);
  const { data, error } = await supabase
    .from("document_types")
    .select(
      "id, company_id, name, default_duration_months, reminder_days, created_at",
    )
    .eq("company_id", company.id)
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Document types" />
        <p className="rounded-md border border-expired-line bg-expired-bg/70 px-4 py-3 text-sm text-expired">
          We couldn&apos;t load your document types. Refresh to try again.
        </p>
      </div>
    );
  }

  const limitCheck = await limitCheckPromise;

  return (
    <DocumentTypesManager
      types={(data ?? []) as DocumentType[]}
      atLimit={!limitCheck.allowed}
      limit={limitCheck.limit}
    />
  );
}
