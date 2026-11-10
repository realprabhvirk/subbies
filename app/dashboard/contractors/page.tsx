import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";

import { PageHeader } from "@/app/components/page-header";
import { Avatar } from "@/app/components/avatar";
import { ListRow, RowList } from "@/app/components/list-row";
import { complianceTodayUtcMs } from "@/lib/time/compliance-today";
import { bucketContractors } from "@/lib/dashboard-buckets";
import { CONTRACTOR_FILTERS, parseContractorFilter, type ContractorFilter } from "@/lib/contractor-filter";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { canAddContractor } from "@/lib/billing/entitlements";
import { DAILY_LIMIT_MESSAGE } from "@/lib/email/send-cap";
import { StatusBadge } from "@/app/components/status-badge";
import { Alert } from "@/app/components/alert";
import { EmptyState } from "@/app/components/empty-state";
import { ButtonLink } from "@/app/components/button";
import type { Contractor, DocumentStatus } from "@/lib/types";
import { ResendButton } from "./_components/resend-button";

export const metadata: Metadata = { title: "Contractors" };

type ContractorRow = Pick<
  Contractor,
  "id" | "business_name" | "contact_name" | "email" | "trade" | "status" | "created_at"
>;

export default async function ContractorsPage(
  props: PageProps<"/dashboard/contractors">,
) {
  const company = await getCompany();
  if (!company) return null;

  const searchParams = await props.searchParams;
  const created =
    typeof searchParams.created === "string" ? searchParams.created : null;
  const emailIssue =
    typeof searchParams.email === "string" ? searchParams.email : null;
  const deleted =
    typeof searchParams.deleted === "string" ? searchParams.deleted : null;
  const filter = parseContractorFilter(searchParams.status);

  const supabase = await createClient();
  // Independent of each other: the limit check never reads the list.
  const [{ data, error }, limitCheck] = await Promise.all([
    supabase
      .from("contractors")
      .select("id, business_name, contact_name, email, trade, status, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false }),
    canAddContractor(company.id),
  ]);

  const contractors = (data ?? []) as ContractorRow[];

  // Per-contractor document progress, plus the expiry dates the filter chips
  // need (the same buckets the dashboard tiles use).
  const progress = new Map<string, { approved: number; total: number }>();
  let docRows: { contractor_id: string; status: DocumentStatus; expiry_date: string | null }[] = [];
  if (contractors.length > 0) {
    const { data: docs } = await supabase
      .from("contractor_documents")
      .select("contractor_id, status, expiry_date")
      // Live documents only, so "2/3 approved" isn't inflated by archived
      // records or a replacement still waiting on the contractor.
      .is("archived_at", null)
      .is("replaces_document_id", null)
      .in(
        "contractor_id",
        contractors.map((c) => c.id),
      );
    docRows = (docs ?? []) as typeof docRows;
    for (const doc of docRows) {
      const entry = progress.get(doc.contractor_id) ?? { approved: 0, total: 0 };
      entry.total += 1;
      if (doc.status === "approved") entry.approved += 1;
      progress.set(doc.contractor_id, entry);
    }
  }

  const buckets = bucketContractors({
    contractors,
    docs: docRows,
    todayMs: complianceTodayUtcMs(),
  });
  const matches: Record<ContractorFilter, (c: ContractorRow) => boolean> = {
    all: () => true,
    approved: (c) => c.status === "approved" && !buckets.expiredIds.has(c.id),
    pending: (c) =>
      c.status === "pending" || c.status === "awaiting_review" || c.status === "attention_required",
    expiring: (c) => buckets.expiringIds.has(c.id),
    expired: (c) => buckets.expiredIds.has(c.id),
  };
  const filterCounts: Record<ContractorFilter, number> = {
    all: contractors.length,
    approved: buckets.approvedCount,
    pending: buckets.pendingCount,
    expiring: buckets.expiringIds.size,
    expired: buckets.expiredIds.size,
  };
  const visible = contractors.filter(matches[filter]);

  const dateFmt = new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const counts = {
    total: contractors.length,
    approved: contractors.filter((c) => c.status === "approved").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contractors"
        description={
          contractors.length === 0
            ? "Everyone you've requested compliance documents from."
            : `${counts.total} on the register · ${counts.approved} fully approved`
        }
        actions={
          limitCheck.allowed ? (
            <ButtonLink href="/dashboard/contractors/new">
              <Plus className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              Add contractor
            </ButtonLink>
          ) : (
            <ButtonLink href="/dashboard/settings?tab=billing" variant="secondary">
              Upgrade to add more
            </ButtonLink>
          )
        }
      />

      {!limitCheck.allowed && (
        <Alert tone="warning">
          You&apos;re at your plan&apos;s limit of {limitCheck.limit}{" "}
          contractors.{" "}
          <Link
            href="/dashboard/settings?tab=billing"
            className="font-medium underline"
          >
            Upgrade your plan
          </Link>{" "}
          to add more.
        </Alert>
      )}

      {created && (
        <Alert tone={emailIssue ? "warning" : "success"}>
          {emailIssue === "not_configured" ? (
            <>
              <strong>{created}</strong> was added, but the onboarding email
              couldn&apos;t be sent because email isn&apos;t configured yet. Use{" "}
              <em>Resend request</em> once it&apos;s set up.
            </>
          ) : emailIssue === "send_failed" ? (
            <>
              <strong>{created}</strong> was added, but the onboarding email
              failed to send. Try <em>Resend request</em> in a moment.
            </>
          ) : emailIssue === "daily_limit" ? (
            <>
              <strong>{created}</strong> was added, but the onboarding email
              wasn&apos;t sent: {DAILY_LIMIT_MESSAGE} Use <em>Resend request</em>{" "}
              then.
            </>
          ) : (
            <>
              <strong>{created}</strong> was added and the onboarding request
              has been emailed.
            </>
          )}
        </Alert>
      )}

      {deleted && (
        <Alert tone="success">
          <strong>{deleted}</strong> was deleted, along with their documents and
          files.
        </Alert>
      )}

      {error && (
        <Alert tone="error">
          We couldn&apos;t load your contractors. Refresh to try again.
        </Alert>
      )}

      {contractors.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contractors yet"
          description="Add a contractor to request their compliance documents and send them a secure upload link."
          action={
            <ButtonLink href="/dashboard/contractors/new">
              <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
              Add contractor
            </ButtonLink>
          }
        />
      ) : (
        <>
          <nav aria-label="Filter contractors by status" className="-mx-1 flex flex-wrap gap-2 px-1">
            {CONTRACTOR_FILTERS.map((f) => {
              const active = f.id === filter;
              return (
                <Link
                  key={f.id}
                  href={f.id === "all" ? "/dashboard/contractors" : `/dashboard/contractors?status=${f.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors duration-[var(--duration-fast)] ${
                    active
                      ? "border-brand bg-brand text-white"
                      : "border-line-strong bg-surface text-ink hover:border-field-line hover:bg-surface-muted"
                  }`}
                >
                  {f.label}
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-2xs font-medium ${
                      active ? "bg-white/20 text-white" : "bg-surface-muted text-ink-muted"
                    }`}
                  >
                    {filterCounts[f.id]}
                  </span>
                </Link>
              );
            })}
          </nav>

          {visible.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No contractors match this filter"
              description="Nothing on the register is in this state right now."
              action={
                <ButtonLink href="/dashboard/contractors" variant="secondary">
                  Show all contractors
                </ButtonLink>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-card border border-line bg-surface shadow-sm">
              <RowList className="border-t-0">
                {visible.map((c) => {
                  const p = progress.get(c.id);
                  const canResend =
                    c.status === "pending" ||
                    c.status === "awaiting_review" ||
                    c.status === "attention_required";
                  const docs =
                    p && p.total > 0 ? (
                      <div className="w-28">
                        <p className="font-mono text-xs text-ink">
                          {p.approved}/{p.total}
                          <span className="font-sans text-ink-muted"> approved</span>
                        </p>
                        <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                          <div
                            className="h-full rounded-full bg-tile-approved-disc"
                            style={{ width: `${Math.round((p.approved / p.total) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="w-28 text-xs text-ink-subtle">No documents</p>
                    );
                  const added = dateFmt.format(new Date(c.created_at));
                  return (
                    <ListRow
                      key={c.id}
                      href={`/dashboard/contractors/${c.id}`}
                      leading={<Avatar name={c.business_name} />}
                      title={c.business_name}
                      meta={[c.trade, c.email].filter(Boolean).join(" · ")}
                      footer={
                        <>
                          <StatusBadge kind="contractor" status={c.status} size="sm" />
                          {docs}
                          <span className="whitespace-nowrap font-mono text-xs text-ink-muted">Added {added}</span>
                        </>
                      }
                      trailing={
                        <>
                          {docs}
                          <span className="flex w-52 justify-start">
                            <StatusBadge kind="contractor" status={c.status} />
                          </span>
                          <span className="hidden w-28 font-mono text-xs text-ink-muted xl:block">{added}</span>
                        </>
                      }
                      actions={canResend ? <ResendButton contractorId={c.id} /> : undefined}
                    />
                  );
                })}
              </RowList>
            </div>
          )}
        </>
      )}
    </div>
  );
}
