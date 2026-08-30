import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import type { DocumentType } from "@/lib/types";
import { DocumentTypesManager } from "./_components/document-types-manager";

export const metadata: Metadata = { title: "Document types" };

export default async function DocumentTypesPage() {
  const company = await getCompany();
  if (!company) return null;

  const supabase = await createClient();
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
        <h1 className="text-2xl font-semibold">Document types</h1>
        <p className="rounded-md bg-expired-bg px-4 py-3 text-sm text-expired">
          We couldn&apos;t load your document types. Refresh to try again.
        </p>
      </div>
    );
  }

  return <DocumentTypesManager types={(data ?? []) as DocumentType[]} />;
}
