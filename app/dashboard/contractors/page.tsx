import type { Metadata } from "next";
import Link from "next/link";
import { Plus, CircleCheck, TriangleAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { StatusBadge } from "@/app/components/status-badge";
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

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractors")
    .select("id, business_name, contact_name, email, trade, status, created_at")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  const contractors = (data ?? []) as ContractorRow[];

  // Per-contractor document progress.
  const progress = new Map<string, { approved: number; total: number }>();
  if (contractors.length > 0) {
    const { data: docs } = await supabase
      .from("contractor_documents")
      .select("contractor_id, status")
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
        <Link
          href="/dashboard/contractors/new"
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
        >
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Add contractor
        </Link>
      </header>

      {created && (
        <div
          className={`flex items-start gap-2 rounded-md px-4 py-3 text-sm ${
            emailIssue
              ? "bg-attention-bg text-attention"
              : "bg-approved-bg text-approved"
          }`}
        >
          {emailIssue ? (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          ) : (
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          )}
          <span>
            {emailIssue === "not_configured" ? (
              <>
                <strong>{created}</strong> was added, but the onboarding email
                couldn&apos;t be sent because email isn&apos;t configured yet.
                Use <em>Resend request</em> once it&apos;s set up.
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
          </span>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-expired-bg px-4 py-3 text-sm text-expired">
          We couldn&apos;t load your contractors. Refresh to try again.
        </p>
      )}

      {contractors.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
          <p className="text-sm font-medium">No contractors yet</p>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">
            Add a contractor to request their compliance documents and send them
            a secure upload link.
          </p>
          <Link
            href="/dashboard/contractors/new"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Add contractor
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {contractors.map((c) => {
            const p = progress.get(c.id);
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4"
              >
                <div className="min-w-0 grow">
                  <Link
                    href={`/dashboard/contractors/${c.id}`}
                    className="font-medium hover:text-brand hover:underline"
                  >
                    {c.business_name}
                  </Link>
                  <p className="truncate text-sm text-ink-muted">
                    {[c.trade, c.email].filter(Boolean).join(" · ")}
                  </p>
                </div>

                <div className="flex items-center gap-4">
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
                    <ResendButton contractorId={c.id} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
