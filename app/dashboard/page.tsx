import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleCheck,
  CircleDashed,
  CalendarClock,
  CircleX,
  ArrowRight,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { StatusBadge } from "@/app/components/status-badge";
import { Card, CardHeader, StatCard, type StatTone } from "@/app/components/card";
import { Alert } from "@/app/components/alert";
import { ButtonLink } from "@/app/components/button";
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

/** Up to two initials from a business name, for the avatar tile. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "–";
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
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
  // The contractor list and the project rollup below are independent of each
  // other, so they go out together rather than one after the other.
  const [{ data: contractorData, error }, { data: projectRows }] =
    await Promise.all([
      supabase
        .from("contractors")
        .select("id, business_name, trade, status")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id, project_contractors(removed_at, contractors(status))")
        .eq("company_id", company.id)
        .neq("status", "completed"),
    ]);

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

  // Share of the roster each figure represents, so a number reads against the
  // total without needing a chart. Guarded: no contractors means no bar.
  const total = contractors.length;
  const shareOf = (n: number) => (total > 0 ? n / total : undefined);

  const stats: {
    label: string;
    value: number;
    icon: typeof CircleCheck;
    tone: StatTone;
    note?: string;
    share?: number;
  }[] = [
    {
      label: "Approved",
      value: approvedCount,
      icon: CircleCheck,
      tone: "approved",
      share: shareOf(approvedCount),
    },
    {
      label: "Pending onboarding",
      value: pendingCount,
      icon: CircleDashed,
      tone: "neutral",
      share: shareOf(pendingCount),
    },
    {
      label: "Expiring soon",
      value: expiringContractorIds.size,
      icon: CalendarClock,
      tone: "attention",
      note: `Within ${EXPIRING_WINDOW_DAYS} days`,
      share: shareOf(expiringContractorIds.size),
    },
    {
      label: "Expired",
      value: expiredContractorIds.size,
      icon: CircleX,
      tone: "expired",
      share: shareOf(expiredContractorIds.size),
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
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
          Dashboard
        </p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
          Keep your crew compliant.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Track documents, stay ahead of expiry dates, and keep{" "}
          {company.name}&apos;s projects moving.
        </p>
      </header>

      {error && (
        <Alert tone="error">
          We couldn&apos;t load your contractors just now. Refresh to try again.
        </Alert>
      )}

      {projectsWithIssues > 0 && (
        <Link href="/dashboard/projects" className="block">
          <Alert
            tone="warning"
            className="transition-[opacity,box-shadow,transform] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:-translate-y-px hover:opacity-90 hover:shadow-sm"
            action={
              <ArrowRight
                className="mt-0.5 h-4 w-4 shrink-0"
                strokeWidth={2}
                aria-hidden
              />
            }
          >
            {projectsWithIssues}{" "}
            {projectsWithIssues === 1 ? "project has" : "projects have"} a
            contractor that isn&apos;t compliant
          </Alert>
        </Link>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            tone={stat.tone}
            note={stat.note}
            share={stat.share}
          />
        ))}
      </section>

      <Card padded={false}>
        <CardHeader
          title="Action required"
          description="Contractors with documents to review or issues to resolve."
          action={
            actionRequired.length > 0 ? (
              <ButtonLink
                href="/dashboard/contractors"
                variant="secondary"
                size="sm"
              >
                View all
              </ButtonLink>
            ) : undefined
          }
        />

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
                  className="group flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors duration-[var(--duration-fast)] hover:bg-surface-muted"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold text-ink-muted"
                    >
                      {initialsOf(c.business_name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.business_name}</p>
                      {c.trade && (
                        <p className="truncate text-sm text-ink-muted">
                          {c.trade}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      kind="contractor"
                      status={
                        expiredContractorIds.has(c.id) ? "expired" : c.status
                      }
                    />
                    <ArrowRight
                      className="h-4 w-4 text-ink-subtle transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)] group-hover:translate-x-0.5"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

    </div>
  );
}
