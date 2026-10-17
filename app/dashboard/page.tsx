import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleCheck,
  CircleDashed,
  CalendarClock,
  CircleX,
  ArrowRight,
  ChevronRight,
  FileText,
  UserPlus,
  Inbox,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { StatusBadge } from "@/app/components/status-badge";
import { type StatTone } from "@/app/components/card";
import { Alert } from "@/app/components/alert";
import { ButtonLink } from "@/app/components/button";
import { Avatar } from "@/app/components/avatar";
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
      // Live documents only: an archived (or not-yet-approved replacement)
      // row must not add to the expired / expiring counts.
      .is("archived_at", null)
      .is("replaces_document_id", null)
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

  // --- Presentation only below this line: ordering and labels for display.
  // Nothing here changes a count or a status.

  const effectiveStatus = (c: ContractorRow): ContractorStatus =>
    expiredContractorIds.has(c.id) ? "expired" : c.status;

  // Worst first: expired, then rejected documents, then reviews waiting.
  const URGENCY: Partial<Record<ContractorStatus, number>> = {
    expired: 0,
    attention_required: 1,
    awaiting_review: 2,
  };
  const queue = [...actionRequired].sort(
    (a, b) =>
      (URGENCY[effectiveStatus(a)] ?? 9) - (URGENCY[effectiveStatus(b)] ?? 9),
  );

  const REASON: Partial<Record<ContractorStatus, string>> = {
    expired: "A document has expired",
    attention_required: "A document was rejected and needs re-uploading",
    awaiting_review: "Documents waiting for your review",
  };

  // Soonest upcoming expiry per contractor in the expiring set, for the
  // "coming up" list.
  const soonest = new Map<string, number>();
  for (const doc of docs) {
    if (doc.status !== "approved" || !doc.expiry_date) continue;
    if (!expiringContractorIds.has(doc.contractor_id)) continue;
    const expiry = new Date(doc.expiry_date + "T00:00:00").getTime();
    if (expiry < today) continue;
    const prev = soonest.get(doc.contractor_id);
    if (prev === undefined || expiry < prev) soonest.set(doc.contractor_id, expiry);
  }
  const comingUp = contractors
    .filter((c) => soonest.has(c.id))
    .map((c) => ({
      ...c,
      daysLeft: Math.round((soonest.get(c.id)! - today) / 86_400_000),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const todayLabel = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Australia/Brisbane",
  }).format(new Date());

  const [approvedStat, ...otherStats] = stats;
  const approvedShare = total > 0 ? approvedCount / total : 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-6">
        <div className="min-w-0">
          <p className="label-caps text-ink-muted">{todayLabel}</p>
          <h1 className="mt-2 text-2xl sm:text-3xl">{company.name}</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {total === 0 ? (
              "Your register is empty. Add a contractor to get started."
            ) : (
              <>
                <span className="font-semibold text-ink">{total}</span>{" "}
                {total === 1 ? "contractor" : "contractors"} on the register
                {" · "}
                {actionRequired.length === 0 ? (
                  "nothing needs you right now"
                ) : (
                  <>
                    <span className="font-semibold text-ink">
                      {actionRequired.length}
                    </span>{" "}
                    {actionRequired.length === 1 ? "needs" : "need"} you
                  </>
                )}
              </>
            )}
          </p>
        </div>
        <ButtonLink href="/dashboard/contractors/new" variant="secondary" size="sm">
          <UserPlus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Add contractor
        </ButtonLink>
      </header>

      {error && (
        <Alert tone="error">
          We couldn&apos;t load your contractors just now. Refresh to try again.
        </Alert>
      )}

      {contractors.length === 0 ? (
        <GettingStarted />
      ) : (
        <>
          {/* The figures row: one ruled panel, the compliant share leading,
              then the three numbers that need watching. */}
          <section
            aria-label="Compliance summary"
            className="grid grid-cols-2 overflow-hidden rounded-card border border-line bg-surface xl:grid-cols-[1.6fr_1fr_1fr_1fr]"
          >
            <div className="col-span-2 border-b border-line p-5 sm:p-6 xl:col-span-1 xl:border-b-0 xl:border-r">
              <p className="label-caps flex items-center gap-1.5 text-ink-muted">
                <CircleCheck className="h-3.5 w-3.5 text-approved" strokeWidth={2.5} aria-hidden />
                {approvedStat.label}
              </p>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="figure text-5xl text-ink">{approvedStat.value}</span>
                <span className="text-sm text-ink-muted">of {total} contractors</span>
              </p>
              <div
                className="mt-5 h-2 overflow-hidden rounded-sm bg-line"
                role="img"
                aria-label={`${Math.round(approvedShare * 100)}% of contractors approved`}
              >
                <div
                  className="h-full bg-approved"
                  style={{ width: `${Math.round(approvedShare * 100)}%` }}
                />
              </div>
            </div>
            {otherStats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={[
                    "min-w-0 p-5 sm:p-6",
                    i === 1 ? "border-l border-line" : "",
                    i === 2 ? "col-span-2 border-t border-line xl:col-span-1 xl:border-l xl:border-t-0" : "",
                  ].join(" ")}
                >
                  <p className="label-caps flex items-center gap-1.5 text-ink-muted">
                    <Icon
                      className={`h-3.5 w-3.5 ${TONE_TEXT[stat.tone]}`}
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    {stat.label}
                  </p>
                  <p
                    className={`figure mt-4 text-3xl sm:text-4xl ${
                      stat.value > 0 && stat.tone !== "neutral"
                        ? TONE_TEXT[stat.tone]
                        : "text-ink"
                    }`}
                  >
                    {stat.value}
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    {stat.note ?? (stat.tone === "expired" ? "Not cleared for site" : "Still collecting documents")}
                  </p>
                </div>
              );
            })}
          </section>

          <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
            {/* Needs you — the reason to open the app. */}
            <section aria-labelledby="needs-you" className="min-w-0">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 id="needs-you" className="text-xl">
                    Needs you
                    {queue.length > 0 && (
                      <span className="ml-2 align-middle font-mono text-sm font-medium text-ink-muted">
                        {queue.length}
                      </span>
                    )}
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    Most urgent first.
                  </p>
                </div>
                <Link
                  href="/dashboard/contractors"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
                >
                  All contractors
                  <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </Link>
              </div>

              {queue.length === 0 ? (
                <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-5 py-6">
                  <CircleCheck className="h-6 w-6 shrink-0 text-approved" strokeWidth={2} aria-hidden />
                  <div>
                    <p className="font-semibold">Nothing needs you right now</p>
                    <p className="text-sm text-ink-muted">
                      No documents to review and nothing has expired.
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                  {queue.map((c) => {
                    const status = effectiveStatus(c);
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/dashboard/contractors/${c.id}`}
                          className="group flex items-center gap-4 py-4 pl-4 pr-3 transition-colors duration-[var(--duration-fast)] hover:bg-surface-muted sm:pl-5"
                        >
                          <span
                            aria-hidden
                            className={`w-1 self-stretch rounded-full ${BAR[status] ?? "bg-line"}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-ink">{c.business_name}</p>
                            <p className="truncate text-sm text-ink-muted">
                              {REASON[status]}
                              {c.trade && (
                                <span className="hidden sm:inline"> · {c.trade}</span>
                              )}
                            </p>
                          </div>
                          <StatusBadge kind="contractor" status={status} className="hidden sm:inline-flex" />
                          <ChevronRight
                            className="h-5 w-5 shrink-0 text-ink-subtle transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5 group-hover:text-ink"
                            strokeWidth={2}
                            aria-hidden
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <aside className="min-w-0 space-y-6">
              {projectsWithIssues > 0 && (
                <Link href="/dashboard/projects" className="block rounded-md">
                  <Alert
                    tone="warning"
                    className="transition-colors duration-[var(--duration-fast)] hover:bg-attention-bg"
                    action={
                      <ArrowRight
                        className="mt-0.5 h-4 w-4 shrink-0"
                        strokeWidth={2.25}
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

              <section aria-labelledby="coming-up">
                <h2 id="coming-up" className="text-base">
                  Expiring in the next {EXPIRING_WINDOW_DAYS} days
                </h2>
                {comingUp.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-muted">
                    Nothing is due to expire in the next {EXPIRING_WINDOW_DAYS} days.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-line border-y border-line">
                    {comingUp.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/dashboard/contractors/${c.id}`}
                          className="group flex items-center gap-3 py-3 transition-colors hover:text-brand"
                        >
                          <Avatar name={c.business_name} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {c.business_name}
                          </span>
                          <span
                            className={`shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-2xs font-medium ${
                              c.daysLeft <= 7
                                ? "border-attention-line bg-attention-bg text-attention"
                                : "border-line-strong bg-surface-muted text-ink-muted"
                            }`}
                          >
                            {c.daysLeft === 0 ? "today" : `${c.daysLeft}d`}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

const TONE_TEXT: Record<StatTone, string> = {
  neutral: "text-neutral-status",
  approved: "text-approved",
  review: "text-review",
  attention: "text-attention",
  expired: "text-expired",
};

const BAR: Partial<Record<ContractorStatus, string>> = {
  expired: "bg-expired",
  attention_required: "bg-attention",
  awaiting_review: "bg-review",
};

/** First-run panel: the three real steps, each pointing at the real page. */
function GettingStarted() {
  const steps = [
    {
      icon: FileText,
      title: "Set your document checklist",
      body: "Public liability, licences, workers' comp — whatever you need on file.",
      href: "/dashboard/document-types",
      cta: "Document types",
    },
    {
      icon: UserPlus,
      title: "Add your first contractor",
      body: "Pick the documents you need from them. We email a secure upload link.",
      href: "/dashboard/contractors/new",
      cta: "Add contractor",
    },
    {
      icon: Inbox,
      title: "Review what comes back",
      body: "Set expiry dates, approve or reject. Reminders go out before anything lapses.",
      href: "/dashboard/contractors",
      cta: "Contractors",
    },
  ];
  return (
    <section aria-labelledby="getting-started">
      <h2 id="getting-started" className="text-xl">
        Get set up in three steps
      </h2>
      <ol className="mt-4 grid overflow-hidden rounded-card border border-line bg-surface md:grid-cols-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className={`flex flex-col p-5 sm:p-6 ${i > 0 ? "border-t border-line md:border-l md:border-t-0" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="figure text-3xl text-line-strong">0{i + 1}</span>
                <Icon className="h-5 w-5 text-ink-subtle" strokeWidth={2} aria-hidden />
              </div>
              <p className="mt-5 font-semibold">{step.title}</p>
              <p className="mt-1 flex-1 text-sm text-ink-muted">{step.body}</p>
              <Link
                href={step.href}
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
              >
                {step.cta}
                <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
