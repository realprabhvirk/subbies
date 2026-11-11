import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleCheck,
  CircleDashed,
  CalendarClock,
  CircleX,
  ArrowRight,
  FileText,
  UserPlus,
  Inbox,
  ListChecks,
  TriangleAlert,
  Clock,
  ChartPie,
  Zap,
  History,
  FolderKanban,
  Settings,
  Upload,
  type LucideIcon,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { complianceTodayUtcMs } from "@/lib/time/compliance-today";
import { bucketContractors, EXPIRING_WINDOW_DAYS } from "@/lib/dashboard-buckets";
import { relativeTime } from "@/lib/relative-time";
import { balanceColumns } from "@/lib/balance-columns";
import { StatusBadge } from "@/app/components/status-badge";
import { Alert } from "@/app/components/alert";
import { ButtonLink } from "@/app/components/button";
import { Avatar } from "@/app/components/avatar";
import { PageHeader } from "@/app/components/page-header";
import { SectionCard } from "@/app/components/section-card";
import { StatTile } from "@/app/components/stat-tile";
import { ListRow, RowList } from "@/app/components/list-row";
import { ActionTile } from "@/app/components/action-tile";
import { IconDisc, type DiscTone } from "@/app/components/icon-disc";
import { DonutChart, DonutLegend, type DonutSegment } from "@/app/components/donut-chart";
import { getSubscriptionRow } from "@/lib/billing/entitlements";
import { can, isPlanId } from "@/lib/billing/plans";
import { computeProjectCompliance } from "@/lib/compliance/project";
import { loadComplianceInputs } from "@/lib/projects/compliance-data";
import { complianceToday as complianceTodayDate } from "@/lib/time/compliance-today";
import type { ContractorStatus, DocumentStatus } from "@/lib/types";
import { Greeting } from "./_components/greeting";
import { HeaderPhotoBand } from "./_components/header-photo-band";
import { loadNotifications } from "./_components/notifications-slot";

export const metadata: Metadata = { title: "Dashboard" };

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

export default async function DashboardPage() {
  const company = await getCompany();
  if (!company) return null;

  const supabase = await createClient();
  // The contractor list, the project rollup and the recent activity are
  // independent of each other, so they go out together. Activity reuses the
  // bell's per-request cached notifications query: no extra round trip.
  const [{ data: contractorData, error }, { data: projectRows }, { notifications }] =
    await Promise.all([
      supabase
        .from("contractors")
        .select("id, business_name, trade, status")
        .eq("company_id", company.id)
        // Archived contractors are off the register: no tiles, no counts.
        .is("archived_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select("id")
        .eq("company_id", company.id)
        .neq("status", "completed"),
      loadNotifications(),
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

  // Open projects with at least one assigned contractor not cleared for
  // that project, from the one compliance engine (three queries in total).
  let projectsWithIssues = 0;
  const openProjectIds = ((projectRows ?? []) as { id: string }[]).map((p) => p.id);
  if (openProjectIds.length > 0) {
    const sub = await getSubscriptionRow(company.id);
    const plan = isPlanId(sub?.plan) ? sub!.plan : null;
    const { byProject } = await loadComplianceInputs(supabase, openProjectIds);
    const projectNow = complianceTodayDate();
    for (const inputs of byProject.values()) {
      const r = computeProjectCompliance({
        requirements: inputs.requirements,
        contractors: inputs.contractors,
        documents: inputs.documents,
        now: projectNow,
        mode: can(plan, "requirements") ? "requirements" : "basic",
      });
      if (r.clearedCount < r.assignedCount) projectsWithIssues += 1;
    }
  }

  // UTC midnight of today's Queensland date, matched by the "...T00:00:00Z"
  // expiry parse in bucketContractors, so buckets flip on the right day.
  const today = complianceTodayUtcMs();
  const { expiredIds, expiringIds, approvedCount, pendingCount, exclusive } =
    bucketContractors({ contractors, docs, todayMs: today });

  const total = contractors.length;
  const shareOf = (n: number) => (total > 0 ? n / total : undefined);

  const actionRequired = contractors.filter(
    (c) =>
      c.status === "awaiting_review" ||
      c.status === "attention_required" ||
      c.status === "expired" ||
      expiredIds.has(c.id),
  );

  // --- Presentation only below this line: ordering and labels for display.
  // Nothing here changes a count or a status.

  const effectiveStatus = (c: ContractorRow): ContractorStatus =>
    expiredIds.has(c.id) ? "expired" : c.status;

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
    if (!expiringIds.has(doc.contractor_id)) continue;
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
    month: "short",
    year: "numeric",
    timeZone: "Australia/Brisbane",
  }).format(new Date());

  const segments: DonutSegment[] = [
    { key: "approved", label: "Approved, not expiring", value: exclusive.approved, color: "var(--color-tile-approved-disc)" },
    { key: "pending", label: "Pending onboarding", value: exclusive.pending, color: "var(--color-tile-pending-disc)" },
    { key: "expiring", label: "Expiring soon", value: exclusive.expiring, color: "var(--color-tile-expiring-disc)" },
    { key: "expired", label: "Expired", value: exclusive.expired, color: "var(--color-tile-expired-disc)" },
  ];

  const recent = notifications.slice(0, 5);

  const QUEUE_DISC: Partial<Record<ContractorStatus, { tone: DiscTone; icon: LucideIcon }>> = {
    expired: { tone: "expired", icon: CircleX },
    attention_required: { tone: "expiring", icon: TriangleAlert },
    awaiting_review: { tone: "pending", icon: Clock },
  };

  // --- Card layout. Heights are rough estimates in px, only used to decide
  // which column a card goes in (lib/balance-columns.ts).
  type CardKey = "needs" | "overview" | "expiring" | "recent" | "quick";
  const CARD_ORDER: CardKey[] = ["needs", "overview", "expiring", "recent", "quick"];
  const cards: Record<CardKey, React.ReactNode> = {
    needs: (
      <>
          {total === 0 ? (
            <GettingStarted />
          ) : (
            <SectionCard
              id="needs-you"
              icon={TriangleAlert}
              tone="expired"
              title="Needs you"
              count={queue.length}
              subtitle="Most urgent first."
              action={{ href: "/dashboard/contractors", label: "All contractors" }}
              flush
            >
              {queue.length === 0 ? (
                <div className="flex flex-col items-center border-t border-line px-6 py-14 text-center">
                  <IconDisc icon={CircleCheck} tone="approved" size="lg" />
                  <p className="mt-5 font-display text-card-title font-semibold">Nothing needs you right now</p>
                  <p className="mt-2 max-w-sm text-sm text-ink-muted">
                    No documents to review and nothing has expired.
                  </p>
                </div>
              ) : (
                <RowList>
                  {queue.map((c) => {
                    const status = effectiveStatus(c);
                    const disc = QUEUE_DISC[status];
                    return (
                      <ListRow
                        key={c.id}
                        href={`/dashboard/contractors/${c.id}`}
                        leading={
                          disc ? <IconDisc icon={disc.icon} tone={disc.tone} size="sm" /> : undefined
                        }
                        title={c.business_name}
                        meta={
                          <>
                            {REASON[status]}
                            {c.trade && <span className="hidden sm:inline"> · {c.trade}</span>}
                          </>
                        }
                        trailing={
                          // Hidden on phones: the meta line and the disc
                          // already say it, and the title needs the width.
                          <span className="hidden sm:inline-flex">
                            <StatusBadge kind="contractor" status={status} />
                          </span>
                        }
                      />
                    );
                  })}
                </RowList>
              )}
            </SectionCard>
          )}
      </>
    ),
    overview: (
          <SectionCard id="overview" icon={ChartPie} tone="brand" title="Compliance overview">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-6">
              <DonutChart segments={segments} centerLabel="Total contractors" className="w-44 shrink-0" />
              <div className="min-w-56 flex-1">
                {total === 0 ? (
                  <div>
                    <p className="text-sm text-ink-muted">
                      Add your first contractor and the picture fills in here.
                    </p>
                    <ButtonLink href="/dashboard/contractors/new" className="mt-4">
                      <UserPlus className="h-5 w-5" strokeWidth={2} aria-hidden />
                      Add contractor
                    </ButtonLink>
                  </div>
                ) : (
                  <>
                    <DonutLegend segments={segments} />
                    <p className="mt-4 text-xs text-ink-muted">
                      Each contractor is counted once, by their most urgent status.
                    </p>
                  </>
                )}
              </div>
            </div>
          </SectionCard>
    ),
    expiring: (
      <>
          {total > 0 && (
            <SectionCard
              id="coming-up"
              icon={CalendarClock}
              tone="expiring"
              title={`Expiring in the next ${EXPIRING_WINDOW_DAYS} days`}
              flush
            >
              {comingUp.length === 0 ? (
                <p className="border-t border-line px-card py-6 text-sm text-ink-muted sm:px-6">
                  Nothing is due to expire in the next {EXPIRING_WINDOW_DAYS} days.
                </p>
              ) : (
                <RowList>
                  {comingUp.map((c) => (
                    <ListRow
                      key={c.id}
                      href={`/dashboard/contractors/${c.id}`}
                      leading={<Avatar name={c.business_name} size="sm" />}
                      title={c.business_name}
                      trailing={
                        <span
                          className={`rounded-full border px-3 py-1 font-mono text-2xs font-medium ${
                            c.daysLeft <= 7
                              ? "border-attention-line bg-attention-bg text-attention"
                              : "border-line-strong bg-surface-muted text-ink-muted"
                          }`}
                        >
                          {c.daysLeft === 0 ? "today" : `${c.daysLeft}d`}
                        </span>
                      }
                    />
                  ))}
                </RowList>
              )}
            </SectionCard>
          )}
      </>
    ),
    recent: (
      <>
          {recent.length > 0 && (
            <SectionCard
              id="recent-activity"
              icon={History}
              tone="pending"
              title="Recent activity"
              flush
            >
              <RowList>
                {recent.map((n) => (
                  <ListRow
                    key={n.id}
                    href={n.contractor_id ? `/dashboard/contractors/${n.contractor_id}` : undefined}
                    leading={<IconDisc icon={Upload} tone="neutral" size="sm" />}
                    title={n.message}
                    wrapTitle
                    meta={relativeTime(n.created_at)}
                  />
                ))}
              </RowList>
            </SectionCard>
          )}
      </>
    ),
    quick: (
          <SectionCard id="quick-actions" icon={Zap} tone="brand" title="Quick actions">
            <div className="@container"><div className="grid grid-cols-2 gap-4 @xl:grid-cols-4">
              <ActionTile href="/dashboard/contractors/new" icon={UserPlus} label="Add contractor" variant="primary" />
              <ActionTile href="/dashboard/projects" icon={FolderKanban} label="Projects" />
              <ActionTile href="/dashboard/document-types" icon={FileText} label="Document types" />
              <ActionTile href="/dashboard/settings" icon={Settings} label="Settings" />
            </div></div>
          </SectionCard>
    ),
  };
  const needsHeight = total === 0 ? 340 : queue.length === 0 ? 360 : 110 + queue.length * 76;
  const rest: { key: CardKey; height: number }[] = [];
  if (total > 0) rest.push({ key: "expiring", height: comingUp.length === 0 ? 190 : 100 + comingUp.length * 66 });
  if (recent.length > 0) rest.push({ key: "recent", height: 100 + recent.length * 80 });
  rest.push({ key: "quick", height: 250 });
  const columns = balanceColumns(
    { left: { key: "needs", height: needsHeight }, right: { key: "overview", height: total === 0 ? 480 : 560 } },
    rest,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        size="hero"
        eyebrow={todayLabel}
        band={<HeaderPhotoBand />}
        title={
          <>
            <Greeting />
            <span className="mt-2 block text-card-title font-semibold text-ink-muted">
              {company.name}
            </span>
          </>
        }
        description={
          total === 0 ? (
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
                  <span className="font-semibold text-ink">{actionRequired.length}</span>{" "}
                  {actionRequired.length === 1 ? "needs" : "need"} you
                </>
              )}
            </>
          )
        }
        actions={
          <ButtonLink href="/dashboard/contractors/new">
            <UserPlus className="h-5 w-5" strokeWidth={2} aria-hidden />
            Add contractor
          </ButtonLink>
        }
      />

      {error && (
        <Alert tone="error">
          We couldn&apos;t load your contractors just now. Refresh to try again.
        </Alert>
      )}

      <section
        aria-label="Compliance summary"
        className="relative z-10 grid grid-cols-2 gap-4 xl:grid-cols-4"
      >
        <StatTile
          tone="approved"
          icon={CircleCheck}
          label="Approved"
          value={approvedCount}
          caption={`of ${total} ${total === 1 ? "contractor" : "contractors"}`}
          progress={shareOf(approvedCount)}
          progressLabel={`${Math.round((shareOf(approvedCount) ?? 0) * 100)}% of contractors approved`}
          href="/dashboard/contractors?status=approved"
        />
        <StatTile
          tone="pending"
          icon={CircleDashed}
          label="Pending onboarding"
          value={pendingCount}
          caption="Still collecting documents"
          href="/dashboard/contractors?status=pending"
        />
        <StatTile
          tone="expiring"
          icon={CalendarClock}
          label="Expiring soon"
          value={expiringIds.size}
          caption={`Within ${EXPIRING_WINDOW_DAYS} days`}
          href="/dashboard/contractors?status=expiring"
        />
        <StatTile
          tone="expired"
          icon={CircleX}
          label="Expired"
          value={expiredIds.size}
          caption="Not cleared for site"
          href="/dashboard/contractors?status=expired"
        />
      </section>

      {projectsWithIssues > 0 && (
        <Link href="/dashboard/projects" className="block rounded-md">
          <Alert
            tone="warning"
            className="transition-colors duration-[var(--duration-fast)] hover:bg-attention-bg"
            action={
              <ArrowRight className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
            }
          >
            {projectsWithIssues} {projectsWithIssues === 1 ? "project has" : "projects have"} a
            contractor that isn&apos;t compliant
          </Alert>
        </Link>
      )}

      {/* Two columns, but not a fixed left/right split: each card after the
          first pair goes into whichever column is currently shorter, so
          neither side ends early and leaves a hole. Below xl it's a single
          column in reading order (the wrappers use display: contents and the
          cards carry an explicit order). */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {(["left", "right"] as const).map((side) => (
          <div key={side} className="contents xl:block xl:min-w-0 xl:space-y-6">
            {columns[side].map((key) => (
              <div key={key} style={{ order: CARD_ORDER.indexOf(key) }} className="min-w-0">
                {cards[key]}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** First-run card: the three real steps, each pointing at the real page. */
function GettingStarted() {
  const steps = [
    {
      icon: FileText,
      title: "Set your document checklist",
      body: "Public liability, licences, workers' comp. Whatever you need on file.",
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
    <SectionCard id="getting-started" icon={ListChecks} tone="brand" title="Get set up in three steps">
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="flex flex-col rounded-lg border border-line bg-surface-muted p-5">
            <div className="flex items-center justify-between">
              <span className="figure text-3xl text-line-strong">0{i + 1}</span>
              <IconDisc icon={step.icon} tone="brand" size="sm" />
            </div>
            <p className="mt-5 text-sm font-semibold">{step.title}</p>
            <p className="mt-1 flex-1 text-xs text-ink-muted">{step.body}</p>
            <Link
              href={step.href}
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
            >
              {step.cta}
              <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
