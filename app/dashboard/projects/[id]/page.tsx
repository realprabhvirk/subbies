import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CircleCheck, ClipboardList, History, ShieldCheck, TriangleAlert, Users } from "lucide-react";

import { StatTile } from "@/app/components/stat-tile";
import { SectionCard } from "@/app/components/section-card";
import { ListRow, RowList } from "@/app/components/list-row";
import { Avatar } from "@/app/components/avatar";
import { StatusBadge } from "@/app/components/status-badge";
import { Alert } from "@/app/components/alert";
import { ButtonLink } from "@/app/components/button";
import { can } from "@/lib/billing/plans";
import { EXPIRING_WINDOW_DAYS } from "@/lib/compliance/project";
import { getProjectWorkspace } from "./_lib/workspace";
import { loadProjectActivity } from "./_lib/activity";
import { RequestButton } from "./_components/request-button";
import { ActivityFeed } from "./_components/activity-feed";

export const metadata: Metadata = { title: "Project" };

const ATTENTION_SHOWN = 8;

export default async function ProjectOverviewPage(props: PageProps<"/dashboard/projects/[id]">) {
  const { id } = await props.params;
  const ws = await getProjectWorkspace(id);
  if (!ws) return null;
  const { compliance: c, plan, project } = ws;
  const showActivity = can(plan, "activityView");
  const activity = showActivity ? await loadProjectActivity(id, { limit: 5 }) : null;
  const base = `/dashboard/projects/${id}`;

  const attention = c.needsAttention.slice(0, ATTENTION_SHOWN);

  return (
    <div className="space-y-6">
      {ws.loadError && <Alert tone="error">Some compliance data couldn&apos;t be loaded. Refresh to try again.</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          tone="brand"
          icon={ShieldCheck}
          label="Project compliance"
          value={c.percent === null ? "–" : `${c.percent}%`}
          caption={c.percent === null ? "No contractors assigned" : c.mode === "requirements" ? "Against this project's requirements" : "From each contractor's overall status"}
        />
        <StatTile
          tone="approved"
          icon={Users}
          label="Contractors cleared"
          value={`${c.clearedCount} of ${c.assignedCount}`}
          caption="Cleared for site"
        />
        <StatTile
          tone="expired"
          icon={ClipboardList}
          label={c.mode === "requirements" ? "Outstanding requirements" : "Not cleared"}
          value={c.outstandingMandatory}
          caption={c.mode === "requirements" ? "Mandatory documents not yet valid" : "Contractors with an outstanding issue"}
        />
        <StatTile
          tone="expiring"
          icon={CalendarClock}
          label="Expiring soon"
          value={c.expiringCount}
          caption={`Within ${EXPIRING_WINDOW_DAYS} days`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          id="attention"
          className="lg:col-span-2"
          icon={TriangleAlert}
          tone="brand"
          title="Needs attention"
          count={c.needsAttention.length}
          action={c.needsAttention.length > ATTENTION_SHOWN && can(plan, "documentRegister") ? { href: `${base}/documents`, label: "View all" } : undefined}
          flush={attention.length > 0}
        >
          {c.assignedCount === 0 ? (
            <div className="rounded-lg border border-dashed border-line-strong px-card py-8 text-center">
              <p className="text-sm text-ink-muted">No contractors assigned yet.</p>
              <ButtonLink href={`${base}/contractors`} variant="secondary" className="mt-4">
                Assign contractors
              </ButtonLink>
            </div>
          ) : attention.length === 0 ? (
            <div className="flex flex-col items-center px-card py-8 text-center">
              <CircleCheck className="h-8 w-8 text-approved" strokeWidth={2} aria-hidden />
              <p className="mt-3 text-sm font-semibold text-ink">Everyone on this project is cleared</p>
              <p className="mt-1 text-sm text-ink-muted">Nothing is missing, expired or waiting for review.</p>
            </div>
          ) : (
            <RowList>
              {attention.map((item, i) => {
                const canRequest = item.issue === "missing" || item.issue === "expired" || item.issue === "rejected";
                const action = canRequest ? (
                  <RequestButton projectId={project.id} contractorId={item.contractorId} documentTypeId={item.documentTypeId} />
                ) : (
                  <ButtonLink href={`/dashboard/contractors/${item.contractorId}?tab=documents`} variant="secondary" size="sm">
                    Review
                  </ButtonLink>
                );
                return (
                  <ListRow
                    key={`${item.contractorId}-${item.documentTypeId ?? "c"}-${i}`}
                    leading={<Avatar name={item.businessName} />}
                    title={
                      <Link href={`/dashboard/contractors/${item.contractorId}`} className="hover:underline">
                        {item.businessName}
                      </Link>
                    }
                    meta={item.text}
                    footer={<StatusBadge kind="requirement" status={item.issue} size="sm" />}
                    trailing={<StatusBadge kind="requirement" status={item.issue} />}
                    actions={action}
                  />
                );
              })}
            </RowList>
          )}
        </SectionCard>

        {showActivity ? (
          <SectionCard
            id="recent-activity"
            icon={History}
            tone="neutral"
            title="Recent activity"
            action={activity && activity.events.length > 0 ? { href: `${base}/activity`, label: "View all" } : undefined}
          >
            {activity && activity.events.length > 0 ? (
              <ActivityFeed projectId={project.id} initial={activity.events} compact />
            ) : (
              <p className="text-sm text-ink-muted">Activity appears here as things change on this project.</p>
            )}
          </SectionCard>
        ) : (
          <SectionCard id="recent-activity" icon={History} tone="neutral" title="Recent activity">
            <p className="text-sm text-ink-muted">
              Changes on this project are being recorded. Activity history is on the Business plan; see the Activity tab.
            </p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
