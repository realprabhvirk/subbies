import type { Metadata } from "next";
import Link from "next/link";
import { FileSearch } from "lucide-react";

import { UpgradePrompt } from "@/app/components/upgrade-prompt";
import { StatusBadge } from "@/app/components/status-badge";
import { EmptyState } from "@/app/components/empty-state";
import { ButtonLink } from "@/app/components/button";
import { featureError } from "@/lib/billing/plans";
import { describeDays } from "@/lib/compliance/project";
import {
  REGISTER_FILTERS,
  buildRegister,
  filterAndPage,
  parsePage,
  parseRegisterFilter,
  type RegisterRow,
} from "@/lib/compliance/register";
import { complianceToday } from "@/lib/time/compliance-today";
import { getProjectWorkspace } from "../_lib/workspace";
import { RequestButton } from "../_components/request-button";

export const metadata: Metadata = { title: "Project documents" };

const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const momentFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Brisbane" });
const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(`${iso}T00:00:00Z`)) : "–");
const fmtMoment = (iso: string | null) => (iso ? momentFmt.format(new Date(iso)) : "–");

function RowAction({ projectId, row }: { projectId: string; row: RegisterRow }) {
  if (row.state === "missing" || row.state === "expired" || row.state === "rejected") {
    return <RequestButton projectId={projectId} contractorId={row.contractorId} documentTypeId={row.documentTypeId} />;
  }
  return (
    <ButtonLink href={`/dashboard/contractors/${row.contractorId}?tab=documents`} variant="secondary" size="sm">
      {row.state === "pending_review" ? "Review" : "View"}
    </ButtonLink>
  );
}

function expiryText(row: RegisterRow) {
  if (row.state === "missing") return "Not provided";
  if (!row.expiryDate) return "–";
  return fmtDate(row.expiryDate);
}

export default async function ProjectDocumentsPage(props: PageProps<"/dashboard/projects/[id]/documents">) {
  const { id } = await props.params;
  const ws = await getProjectWorkspace(id);
  if (!ws) return null;

  const locked = featureError(ws.plan, "documentRegister");
  if (locked) {
    return (
      <div className="space-y-4">
        <UpgradePrompt error={locked} variant="inline" />
        <p className="max-w-2xl text-sm text-ink-muted">
          The document register lists every document this project needs, for every contractor on it, with filters for
          missing, expired, expiring and pending review, and a Request button for anything outstanding.
        </p>
      </div>
    );
  }

  const sp = await props.searchParams;
  const filter = parseRegisterFilter(sp.status);
  const page = parsePage(sp.page);
  const all = buildRegister({ compliance: ws.compliance, documents: ws.inputs.documents, now: complianceToday() });
  const view = filterAndPage(all, filter, page);
  const base = `/dashboard/projects/${id}/documents`;
  const href = (f: string, p = 1) => {
    const q = new URLSearchParams();
    if (f !== "all") q.set("status", f);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  if (ws.compliance.assignedCount === 0) {
    return (
      <EmptyState
        icon={FileSearch}
        title="No contractors on this project yet"
        description="Assign contractors and their documents appear here."
        action={<ButtonLink href={`/dashboard/projects/${id}/contractors`}>Assign contractors</ButtonLink>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Filter documents by status" className="-mx-1 flex flex-wrap gap-2 px-1">
        {REGISTER_FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <Link
              key={f.id}
              href={href(f.id)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${
                active ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink hover:bg-surface-muted"
              }`}
            >
              {f.label}
              <span className={`rounded-full px-2 py-0.5 font-mono text-2xs font-medium ${active ? "bg-white/20 text-white" : "bg-surface-muted text-ink-muted"}`}>
                {view.counts[f.id]}
              </span>
            </Link>
          );
        })}
      </nav>

      {view.rows.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="Nothing in this state"
          description="No documents on this project match this filter right now."
          action={<ButtonLink href={href("all")} variant="secondary">Show all documents</ButtonLink>}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-card border border-line bg-surface shadow-sm md:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line-strong bg-surface-muted text-left">
                  {["Contractor", "Document type", "Status", "Expiry", "Reviewed", "Last updated", ""].map((h, i) => (
                    <th key={i} scope="col" className="label-caps px-4 py-3 text-ink-muted">
                      {h || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {view.rows.map((r) => (
                  <tr key={r.key} className="transition-colors hover:bg-surface-muted">
                    <td className="max-w-56 px-4 py-3">
                      <Link href={`/dashboard/contractors/${r.contractorId}`} className="block truncate font-semibold text-ink hover:underline">
                        {r.contractorName}
                      </Link>
                    </td>
                    <td className="max-w-56 px-4 py-3">
                      <span className="block truncate text-ink">{r.documentTypeName}</span>
                      {!r.mandatory && <span className="text-2xs text-ink-muted">Optional</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge kind="requirement" status={r.state} size="sm" />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink">
                      {expiryText(r)}
                      {r.daysLeft !== null && (r.state === "expired" || r.state === "expiring") && (
                        <span className="block font-sans text-2xs text-ink-muted">{describeDays(r.daysLeft)}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-muted">{fmtMoment(r.reviewedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-muted">{fmtMoment(r.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <RowAction projectId={ws.project.id} row={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {view.rows.map((r) => (
              <li key={r.key} className="rounded-card border border-line bg-surface p-card shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-ink">{r.documentTypeName}</p>
                    <Link href={`/dashboard/contractors/${r.contractorId}`} className="mt-0.5 block truncate text-xs text-ink-muted hover:underline">
                      {r.contractorName}
                    </Link>
                  </div>
                  <StatusBadge kind="requirement" status={r.state} size="sm" />
                </div>
                <p className="mt-3 font-mono text-xs text-ink">
                  {expiryText(r)}
                  {r.daysLeft !== null && (r.state === "expired" || r.state === "expiring") && (
                    <span className="font-sans text-ink-muted"> · {describeDays(r.daysLeft)}</span>
                  )}
                </p>
                <div className="mt-3">
                  <RowAction projectId={ws.project.id} row={r} />
                </div>
              </li>
            ))}
          </ul>

          {view.pages > 1 && (
            <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="font-mono text-xs text-ink-muted">
                Page {view.page} of {view.pages} · {view.total} rows
              </span>
              <div className="flex gap-2">
                {view.page > 1 && <ButtonLink href={href(filter, view.page - 1)} variant="secondary" size="sm">Previous</ButtonLink>}
                {view.page < view.pages && <ButtonLink href={href(filter, view.page + 1)} variant="secondary" size="sm">Next</ButtonLink>}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
