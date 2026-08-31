import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleCheck,
  CircleDashed,
  CalendarClock,
  CircleX,
  ArrowRight,
  TriangleAlert,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { StatusBadge } from "@/app/components/status-badge";
import { hasComplianceIssue } from "@/lib/projects";
import type { ContractorStatus, DocumentStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

const EXPIRING_WINDOW_DAYS = 30;

interface ContractorRow {
  id: string;
  business_name: string;
  trade: string | null;
  status: ContractorStatus;
}

interface DocRow {
  contractor_id: string;
  status: DocumentStatus;
  expiry_date: string | null;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default async function DashboardPage() {
  const company = await getCompany();
  if (!company) return null;

  const supabase = await createClient();
  const { data: contractorData, error } = await supabase
    .from("contractors")
    .select("id, business_name, trade, status")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  const contractors = (contractorData ?? []) as ContractorRow[];

  let docs: DocRow[] = [];
  if (contractors.length > 0) {
    const { data: docData } = await supabase
      .from("contractor_documents")
      .select("contractor_id, status, expiry_date")
      .in(
        "contractor_id",
        contractors.map((c) => c.id),
      );
    docs = (docData ?? []) as DocRow[];
  }

  // Projects whose currently-assigned contractors include a compliance issue.
  let projectsWithIssues = 0;
  const { data: projectRows } = await supabase
    .from("projects")
    .select("id, project_contractors(removed_at, contractors(status))")
    .eq("company_id", company.id)
    .neq("status", "completed");

  for (const project of (projectRows ?? []) as unknown as {
    id: string;
    project_contractors:
      | { removed_at: string | null; contractors: { status: ContractorStatus } | null }[]
      | null;
  }[]) {
    const active = (project.project_contractors ?? []).filter(
      (pc) => pc.removed_at === null,
    );
    if (active.some((pc) => pc.contractors && hasComplianceIssue(pc.contractors.status))) {
      projectsWithIssues += 1;
    }
  }

  const today = startOfToday();
  const windowEnd = today + EXPIRING_WINDOW_DAYS * 86_400_000;

  const expiringContractorIds = new Set<string>();
  const expiredContractorIds = new Set<string>();
  for (const doc of docs) {
    if (doc.status !== "approved" || !doc.expiry_date) continue;
    const expiry = new Date(doc.expiry_date + "T00:00:00").getTime();
    if (expiry < today) expiredContractorIds.add(doc.contractor_id);
    else if (expiry <= windowEnd) expiringContractorIds.add(doc.contractor_id);
  }
  for (const c of contractors) {
    if (c.status === "expired") expiredContractorIds.add(c.id);
  }
  // A contractor that's already expired shouldn't also count as expiring.
  for (const id of expiredContractorIds) expiringContractorIds.delete(id);

  const approvedCount = contractors.filter(
    (c) => c.status === "approved" && !expiredContractorIds.has(c.id),
  ).length;
  const pendingCount = contractors.filter((c) =>
    ["pending", "awaiting_review", "attention_required"].includes(c.status),
  ).length;

  const stats = [
    {
      label: "Approved",
      value: approvedCount,
      icon: CircleCheck,
      tone: "text-approved",
    },
    {
      label: "Pending onboarding",
      value: pendingCount,
      icon: CircleDashed,
      tone: "text-neutral-status",
    },
    {
      label: "Expiring soon",
      value: expiringContractorIds.size,
      icon: CalendarClock,
      tone: "text-attention",
      note: `Within ${EXPIRING_WINDOW_DAYS} days`,
    },
    {
      label: "Expired",
      value: expiredContractorIds.size,
      icon: CircleX,
      tone: "text-expired",
    },
  ];

  const actionRequired = contractors.filter(
    (c) =>
      c.status === "awaiting_review" ||
      c.status === "attention_required" ||
      c.status === "expired" ||
      expiredContractorIds.has(c.id),
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          An overview of {company.name}&apos;s contractors and what needs
          attention.
        </p>
      </header>

      {error && (
        <p className="rounded-md bg-expired-bg px-4 py-3 text-sm text-expired">
          We couldn&apos;t load your contractors just now. Refresh to try again.
        </p>
      )}

      {projectsWithIssues > 0 && (
        <Link
          href="/dashboard/projects"
          className="flex items-center justify-between gap-3 rounded-md bg-attention-bg px-4 py-3 text-sm text-attention transition-opacity hover:opacity-90"
        >
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            {projectsWithIssues}{" "}
            {projectsWithIssues === 1 ? "project has" : "projects have"} a
            contractor that isn&apos;t compliant
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
        </Link>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-card border border-line bg-surface shadow-sm p-5"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                <Icon className={`h-4 w-4 ${stat.tone}`} strokeWidth={2} aria-hidden />
                {stat.label}
              </div>
              <p className="mt-3 text-3xl font-semibold text-brand-ink tabular-nums">
                {stat.value}
              </p>
              {stat.note && (
                <p className="mt-1 text-xs text-ink-subtle">{stat.note}</p>
              )}
            </div>
          );
        })}
      </section>

      <section className="rounded-card border border-line bg-surface shadow-sm">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">Action required</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Contractors with documents to review or issues to resolve.
          </p>
        </div>

        {contractors.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">
            No contractors yet.{" "}
            <Link
              href="/dashboard/contractors/new"
              className="font-medium text-brand hover:underline"
            >
              Add your first contractor
            </Link>
            .
          </p>
        ) : actionRequired.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">
            Nothing needs attention right now.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {actionRequired.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/contractors/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.business_name}</p>
                    {c.trade && (
                      <p className="truncate text-sm text-ink-muted">
                        {c.trade}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      kind="contractor"
                      status={
                        expiredContractorIds.has(c.id) ? "expired" : c.status
                      }
                    />
                    <ArrowRight
                      className="h-4 w-4 text-ink-subtle"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
