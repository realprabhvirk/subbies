import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Users } from "lucide-react";

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

/** Up to two initials from a business name, for the avatar tile. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "–";
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
}

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

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Contractors</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Everyone you&apos;ve requested compliance documents from.
          </p>
        </div>
        {limitCheck.allowed ? (
          <ButtonLink href="/dashboard/contractors/new" className="shrink-0">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Add contractor
          </ButtonLink>
        ) : (
          <ButtonLink
            href="/dashboard/settings?tab=billing"
            variant="secondary"
            className="shrink-0"
          >
            Upgrade to add more
          </ButtonLink>
        )}
      </header>

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
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-sm">
          {contractors.map((c) => {
            const p = progress.get(c.id);
            return (
              <li
                key={c.id}
                // pr-* reserves room for the chevron (and, on desktop, its label)
                // so the badge and Resend button never slide underneath it.
                className="group relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4 pl-5 pr-10 transition-colors duration-[var(--duration-fast)] hover:bg-surface-muted sm:pr-32"
              >
                <div className="flex min-w-0 grow items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-ink-muted"
                  >
                    {initialsOf(c.business_name)}
                  </span>
                  <div className="min-w-0">
                    {/* The name is the link, stretched over the whole row by
                        the ::after, so the entire row is clickable while the
                        markup stays a single real anchor (keyboard, screen
                        readers and middle-click all behave normally). */}
                    <Link
                      href={`/dashboard/contractors/${c.id}`}
                      className="font-medium after:absolute after:inset-0 hover:text-brand hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand"
                    >
                      {c.business_name}
                    </Link>
                    <p className="truncate text-sm text-ink-muted">
                      {[c.trade, c.email].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>

                {/* Nowrap so the badge and button never break onto two lines in a
                    squeezed row; the group itself wraps instead. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 [&_button]:whitespace-nowrap [&_span]:whitespace-nowrap">
                  <div className="hidden text-right text-xs text-ink-subtle sm:block">
                    {p && p.total > 0 && (
                      <p className="tabular-nums">
                        {p.approved}/{p.total} approved
                      </p>
                    )}
                    <p>Added {dateFmt.format(new Date(c.created_at))}</p>
                  </div>
                  <StatusBadge kind="contractor" status={c.status} />
                  {(c.status === "pending" ||
                    c.status === "awaiting_review" ||
                    c.status === "attention_required") && (
                    <div className="relative z-10">
                      <ResendButton contractorId={c.id} />
                    </div>
                  )}
                </div>

                {/* The "this opens" cue. Always visible (a phone has no hover),
                    and purely decorative: the row's real link is the name. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1.5 text-ink-muted transition-colors duration-[var(--duration-fast)] group-hover:text-brand group-focus-within:text-brand"
                >
                  <span className="hidden text-xs font-medium sm:inline">View details</span>
                  <ChevronRight
                    className="h-5 w-5 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)] group-hover:translate-x-0.5"
                    strokeWidth={2}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
