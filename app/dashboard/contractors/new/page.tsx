import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText, Lock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { canAddContractor } from "@/lib/billing/entitlements";
import type { DocumentType } from "@/lib/types";
import { NewContractorForm } from "./_components/new-contractor-form";

export const metadata: Metadata = { title: "Add contractor" };

export default async function NewContractorPage() {
  const company = await getCompany();
  if (!company) return null;

  const limitCheck = await canAddContractor(company.id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_types")
    .select(
      "id, company_id, name, default_duration_months, reminder_days, created_at",
    )
    .eq("company_id", company.id)
    .order("name", { ascending: true });

  const documentTypes = (data ?? []) as DocumentType[];

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/contractors"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          Contractors
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Add contractor</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Enter their details, choose which documents to request, and we&apos;ll
          email them a secure upload link.
        </p>
      </div>

      {!limitCheck.allowed ? (
        <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-ink-subtle">
            <Lock className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <p className="text-sm font-medium">
            You&apos;re at your plan&apos;s limit of {limitCheck.limit} contractors
          </p>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">
            Upgrade your plan to add more. Your existing contractors and their
            documents aren&apos;t affected.
          </p>
          <Link
            href="/dashboard/settings?tab=billing"
            className="mt-5 inline-flex items-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Go to billing
          </Link>
        </div>
      ) : error ? (
        <p className="rounded-md bg-expired-bg px-4 py-3 text-sm text-expired">
          We couldn&apos;t load your document types. Refresh to try again.
        </p>
      ) : documentTypes.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
          <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-ink-subtle">
            <FileText className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <p className="text-sm font-medium">Add document types first</p>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">
            You need at least one document type before you can request documents
            from a contractor.
          </p>
          <Link
            href="/dashboard/document-types"
            className="mt-5 inline-flex items-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Go to document types
          </Link>
        </div>
      ) : (
        <NewContractorForm documentTypes={documentTypes} />
      )}
    </div>
  );
}
