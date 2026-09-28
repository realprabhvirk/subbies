import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Briefcase, Hash } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { StatusBadge } from "@/app/components/status-badge";
import { buildContractorActivity } from "@/lib/contractor-activity";
import { groupFilesByDocument, type GroupedFile } from "@/lib/document-files-logic";
import { formatAbn, isMissingColumnError } from "@/lib/contractor-details-logic";
import { canResendRequest } from "@/lib/document-actions-logic";
import { describeExpiry } from "@/lib/reminders/expiry-logic";
import type {
  ContractorStatus,
  DocumentStatus,
  ProjectStatus,
} from "@/lib/types";
import { DocumentReviewList } from "./_components/document-review-list";
import { ContractorActivity } from "./_components/contractor-activity";
import { ContractorProjects } from "./_components/contractor-projects";
import { ContractorDetailsPanel } from "./_components/contractor-details-panel";
import { ResendRequestsPanel } from "./_components/resend-requests-panel";

export const metadata: Metadata = { title: "Contractor" };

const TABS = [
  { id: "documents", label: "Documents" },
  { id: "projects", label: "Projects" },
  { id: "activity", label: "Activity" },
  { id: "details", label: "Details" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface DocRow {
  id: string;
  status: DocumentStatus;
  expiry_date: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  document_types: { name: string; default_duration_months: number } | null;
}

interface AssignmentRow {
  id: string;
  role_on_project: string | null;
  assigned_at: string;
  removed_at: string | null;
  projects: { id: string; name: string; status: ProjectStatus } | null;
}

export default async function ContractorDetailPage(
  props: PageProps<"/dashboard/contractors/[id]">,
) {
  const { id } = await props.params;
  const company = await getCompany();
  if (!company) return null;

  const sp = await props.searchParams;
  const requested = typeof sp.tab === "string" ? sp.tab : "documents";
  const tab: TabId = TABS.some((t) => t.id === requested)
    ? (requested as TabId)
    : "documents";

  const supabase = await createClient();

  interface ContractorRow {
    id: string;
    business_name: string;
    contact_name: string | null;
    email: string;
    phone: string | null;
    abn?: string | null;
    trade: string | null;
    status: ContractorStatus;
    created_at: string;
  }

  let { data: contractor, error: contractorError } = await supabase
    .from("contractors")
    .select("id, business_name, contact_name, email, phone, abn, trade, status, created_at")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle<ContractorRow>();

  // `abn` arrived in a later migration. On a deploy that lands before that
  // migration has run, selecting it is an error, which would otherwise read as
  // "this contractor doesn't exist" for every contractor. Fall back to the
  // columns that were always there so the page keeps working either way.
  if (contractorError && isMissingColumnError(contractorError)) {
    ({ data: contractor, error: contractorError } = await supabase
      .from("contractors")
      .select("id, business_name, contact_name, email, phone, trade, status, created_at")
      .eq("id", id)
      .eq("company_id", company.id)
      .maybeSingle<ContractorRow>());
  }

  if (contractorError) {
    console.error("ContractorDetailPage: contractor query failed", contractorError);
  }
  if (!contractor) notFound();

  // Files are fetched as a separate query rather than embedded in the
  // contractor_documents select below. An embed failure poisons the whole
  // query's result — with this contractor's actual document requirements
  // one of the two things riding on it, that previously meant a files-table
  // hiccup could make a contractor with a full document history render as
  // "no documents were requested from this contractor" with nothing logged
  // to say why. Kept separate, its own failure only costs filenames on
  // already-uploaded documents, logged rather than swallowed.
  const [{ data: docsData, error: docsError }, { data: assignmentData }] =
    await Promise.all([
      supabase
        .from("contractor_documents")
        .select(
          "id, status, expiry_date, rejection_reason, created_at, updated_at, document_types(name, default_duration_months)",
        )
        .eq("contractor_id", contractor.id),
      supabase
        .from("project_contractors")
        .select(
          "id, role_on_project, assigned_at, removed_at, projects(id, name, status)",
        )
        .eq("contractor_id", contractor.id)
        .order("assigned_at", { ascending: false }),
    ]);

  if (docsError) {
    console.error("ContractorDetailPage: documents query failed", docsError);
  }

  const docRows = (docsData ?? []) as unknown as DocRow[];
  const assignmentRows = (assignmentData ?? []) as unknown as AssignmentRow[];

  let filesByDoc = new Map<string, GroupedFile[]>();
  if (docRows.length > 0) {
    const { data: files, error: filesError } = await supabase
      .from("contractor_document_files")
      .select("id, file_name, contractor_document_id")
      .in(
        "contractor_document_id",
        docRows.map((d) => d.id),
      );

    if (filesError) {
      console.error(
        "ContractorDetailPage: file list query failed, showing documents without filenames",
        filesError,
      );
    } else {
      filesByDoc = groupFilesByDocument(files ?? []);
    }
  }

  const now = new Date();
  const documents = docRows
    .map((d) => ({
      id: d.id,
      documentName: d.document_types?.name ?? "Document",
      defaultDurationMonths: d.document_types?.default_duration_months ?? 12,
      status: d.status,
      files: filesByDoc.get(d.id) ?? [],
      expiryDate: d.expiry_date,
      // Same date maths as the reminder job, so this badge and the emails
      // can't disagree about whether something is expiring.
      expiryStatus:
        d.status === "approved" ? describeExpiry(d.expiry_date, now) : null,
      rejectionReason: d.rejection_reason,
    }))
    .sort((a, b) => a.documentName.localeCompare(b.documentName));

  const projects = assignmentRows
    .filter((a) => a.projects)
    .map((a) => ({
      assignmentId: a.id,
      projectId: a.projects!.id,
      projectName: a.projects!.name,
      projectStatus: a.projects!.status,
      role: a.role_on_project,
      assignedAt: a.assigned_at,
      removedAt: a.removed_at,
    }));

  const activity = buildContractorActivity({
    createdAt: contractor.created_at,
    documents: docRows.map((d) => ({
      id: d.id,
      name: d.document_types?.name ?? "Document",
      status: d.status,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      expiryDate: d.expiry_date,
      rejectionReason: d.rejection_reason,
    })),
    assignments: assignmentRows
      .filter((a) => a.projects)
      .map((a) => ({
        id: a.id,
        projectName: a.projects!.name,
        assignedAt: a.assigned_at,
        removedAt: a.removed_at,
      })),
  });

  const meta = [
    contractor.trade ? { icon: Briefcase, text: contractor.trade } : null,
    { icon: Mail, text: contractor.email },
    contractor.phone ? { icon: Phone, text: contractor.phone } : null,
    contractor.abn ? { icon: Hash, text: `ABN ${formatAbn(contractor.abn)}` } : null,
  ].filter(Boolean) as { icon: typeof Mail; text: string }[];

  const activeProjectCount = projects.filter((p) => !p.removedAt).length;

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

      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const active = t.id === tab;
          const count =
            t.id === "projects" && activeProjectCount > 0
              ? activeProjectCount
              : null;
          return (
            <Link
              key={t.id}
              href={`/dashboard/contractors/${contractor.id}?tab=${t.id}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-brand text-brand-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
              {count !== null && (
                <span className="rounded-full bg-surface-muted px-1.5 text-xs text-ink-muted">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {tab === "documents" && (
        <section>
          <p className="text-sm text-ink-muted">
            Review each submitted document, set its expiry date, and approve or
            reject it.
          </p>
          <div className="mt-4">
            <DocumentReviewList documents={documents} />
          </div>
          <div className="mt-8">
            <ResendRequestsPanel
              contractorId={contractor.id}
              contractorEmail={contractor.email}
              documents={documents
                .filter((d) => canResendRequest(d.status))
                .map((d) => ({
                  id: d.id,
                  name: d.documentName,
                  status: d.status as "requested" | "rejected",
                }))}
            />
          </div>
        </section>
      )}

      {tab === "projects" && (
        <ContractorProjects projects={projects} />
      )}

      {tab === "details" && (
        <ContractorDetailsPanel
          contractorId={contractor.id}
          initial={{
            businessName: contractor.business_name,
            contactName: contractor.contact_name ?? "",
            email: contractor.email,
            phone: contractor.phone ?? "",
            abn: formatAbn(contractor.abn),
          }}
          counts={{
            documents: docRows.length,
            files: documents.reduce((n, d) => n + d.files.length, 0),
            projects: projects.length,
          }}
        />
      )}

      {tab === "activity" && (
        <section>
          <p className="mb-4 text-sm text-ink-muted">
            Everything that&apos;s happened with this contractor, most recent
            first.
          </p>
          <ContractorActivity events={activity} />
        </section>
      )}
    </div>
  );
}
