import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";

import { PageHeader } from "@/app/components/page-header";
import { Avatar } from "@/app/components/avatar";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { canAddContractor } from "@/lib/billing/entitlements";
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

  // Per-contractor document progress.
  const progress = new Map<string, { approved: number; total: number }>();
  if (contractors.length > 0) {
    const { data: docs } = await supabase
      .from("contractor_documents")
      .select("contractor_id, status")
      // Live documents only, so "2/3 approved" isn't inflated by archived
      // records or a replacement still waiting on the contractor.
      .is("archived_at", null)
      .is("replaces_document_id", null)
      .in(
        "contractor_id",
        contractors.map((c) => c.id),
      );
    for (const doc of (docs ?? []) as {
      contractor_id: string;
      status: DocumentStatus;
    }[]) {
      const entry = progress.get(doc.contractor_id) ?? { approved: 0, total: 0 };
      entry.total += 1;
      if (doc.status === "approved") entry.approved += 1;
      progress.set(doc.contractor_id, entry);
    }
  }

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
              <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
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
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Add contractor
            </ButtonLink>
          }
        />
      ) : (
        <div className="@container overflow-hidden rounded-card border border-line bg-surface">
          {/* Column heads — visual only; every value in a row is
              self-describing for screen readers. */}
          <div
            aria-hidden
            className="hidden items-center gap-5 @4xl:grid-cols-[minmax(0,1fr)_8rem_11rem_10.5rem] @5xl:grid-cols-[minmax(0,1fr)_8.5rem_11.5rem_7.5rem_11rem] @5xl:gap-6 border-b border-line-strong bg-surface-muted px-5 py-2.5 text-ink-muted @4xl:grid"
          >
            <span className="label-caps">Contractor</span>
            <span className="label-caps">Documents</span>
            <span className="label-caps">Status</span>
            <span className="label-caps hidden @5xl:block">Added</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {contractors.map((c) => {
              const p = progress.get(c.id);
              const canResend =
                c.status === "pending" ||
                c.status === "awaiting_review" ||
                c.status === "attention_required";
              return (
                <li
                  key={c.id}
                  className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors duration-[var(--duration-fast)] hover:bg-surface-muted/70 sm:px-5 @4xl:grid-cols-[minmax(0,1fr)_8rem_11rem_10.5rem] @5xl:grid-cols-[minmax(0,1fr)_8.5rem_11.5rem_7.5rem_11rem] @4xl:gap-x-5 @5xl:gap-x-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={c.business_name} />
                    <div className="min-w-0">
                      {/* The name is the link, stretched over the whole row
                          by the ::after, so the entire row is clickable while
                          the markup stays a single real anchor (keyboard,
                          screen readers and middle-click all behave). */}
                      <Link
                        href={`/dashboard/contractors/${c.id}`}
                        className="block truncate font-semibold text-ink after:absolute after:inset-0 group-hover:text-brand focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand"
                      >
                        {c.business_name}
                      </Link>
                      <p className="truncate text-sm text-ink-muted">
                        {[c.trade, c.email].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>

                  {/* Mobile: chevron cue top-right. */}
                  <ChevronRight
                    aria-hidden
                    className="h-5 w-5 text-ink-subtle transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5 group-hover:text-brand @4xl:hidden"
                    strokeWidth={2}
                  />

                  <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-12 @4xl:contents">
                    <div className="flex items-center gap-2.5 @4xl:block">
                      {p && p.total > 0 ? (
                        <>
                          <p className="font-mono text-xs text-ink">
                            {p.approved}/{p.total}
                            <span className="font-sans text-ink-muted"> approved</span>
                          </p>
                          <div
                            aria-hidden
                            className="h-1 w-16 overflow-hidden rounded-full bg-line @4xl:mt-1.5 @4xl:w-24"
                          >
                            <div
                              className="h-full bg-approved"
                              style={{ width: `${Math.round((p.approved / p.total) * 100)}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-ink-subtle">No documents</p>
                      )}
                    </div>
                    <div>
                      <StatusBadge kind="contractor" status={c.status} />
                    </div>
                    {/* The date column only appears once there's room; until
                        then it's in the stacked meta line (phones). */}
                    <p className="font-mono text-xs text-ink-muted @4xl:hidden @5xl:block">
                      <span className="@5xl:hidden">Added </span>
                      {dateFmt.format(new Date(c.created_at))}
                    </p>
                    <div className="relative z-10 flex items-center justify-end gap-2 @max-4xl:ml-auto">
                      {canResend && <ResendButton contractorId={c.id} />}
                      <ChevronRight
                        aria-hidden
                        className="hidden h-5 w-5 shrink-0 text-ink-subtle transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5 group-hover:text-brand @4xl:block"
                        strokeWidth={2}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
