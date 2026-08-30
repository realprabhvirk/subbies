import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Briefcase } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { StatusBadge } from "@/app/components/status-badge";
import type { ContractorStatus, DocumentStatus } from "@/lib/types";
import { DocumentReviewList } from "./_components/document-review-list";

export const metadata: Metadata = { title: "Contractor" };

interface DocRow {
  id: string;
  status: DocumentStatus;
  file_url: string | null;
  expiry_date: string | null;
  rejection_reason: string | null;
  document_types: {
    name: string;
    default_duration_months: number;
  } | null;
}

export default async function ContractorDetailPage(
  props: PageProps<"/dashboard/contractors/[id]">,
) {
  const { id } = await props.params;
  const company = await getCompany();
  if (!company) return null;

  const supabase = await createClient();

  const { data: contractor } = await supabase
    .from("contractors")
    .select("id, business_name, contact_name, email, phone, trade, status, created_at")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle<{
      id: string;
      business_name: string;
      contact_name: string | null;
      email: string;
      phone: string | null;
      trade: string | null;
      status: ContractorStatus;
      created_at: string;
    }>();

  if (!contractor) notFound();

  const { data: docsData } = await supabase
    .from("contractor_documents")
    .select(
      "id, status, file_url, expiry_date, rejection_reason, document_types(name, default_duration_months)",
    )
    .eq("contractor_id", contractor.id);

  const documents = ((docsData ?? []) as unknown as DocRow[])
    .map((d) => ({
      id: d.id,
      documentName: d.document_types?.name ?? "Document",
      defaultDurationMonths: d.document_types?.default_duration_months ?? 12,
      status: d.status,
      hasFile: Boolean(d.file_url),
      expiryDate: d.expiry_date,
      rejectionReason: d.rejection_reason,
    }))
    .sort((a, b) => a.documentName.localeCompare(b.documentName));

  const meta = [
    contractor.trade ? { icon: Briefcase, text: contractor.trade } : null,
    { icon: Mail, text: contractor.email },
    contractor.phone ? { icon: Phone, text: contractor.phone } : null,
  ].filter(Boolean) as { icon: typeof Mail; text: string }[];

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

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{contractor.business_name}</h1>
            {contractor.contact_name && (
              <p className="mt-0.5 text-sm text-ink-muted">
                {contractor.contact_name}
              </p>
            )}
          </div>
          <StatusBadge kind="contractor" status={contractor.status} />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-muted">
          {meta.map((m, i) => {
            const Icon = m.icon;
            return (
              <span key={i} className="inline-flex items-center gap-1.5">
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                {m.text}
              </span>
            );
          })}
        </div>
      </div>

      <section>
        <h2 className="text-base font-semibold">Documents</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Review each submitted document, set its expiry date, and approve or
          reject it.
        </p>
        <div className="mt-4">
          <DocumentReviewList documents={documents} />
        </div>
      </section>
    </div>
  );
}
