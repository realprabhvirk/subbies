import type { Metadata } from "next";
import { History } from "lucide-react";

import { UpgradePrompt } from "@/app/components/upgrade-prompt";
import { SectionCard } from "@/app/components/section-card";
import { Alert } from "@/app/components/alert";
import { featureError } from "@/lib/billing/plans";
import { getProjectBasics } from "../_lib/workspace";
import { loadProjectActivity } from "../_lib/activity";
import { ActivityFeed } from "../_components/activity-feed";

export const metadata: Metadata = { title: "Project activity" };

export default async function ProjectActivityPage(props: PageProps<"/dashboard/projects/[id]/activity">) {
  const { id } = await props.params;
  const basics = await getProjectBasics(id);
  if (!basics) return null;

  const locked = featureError(basics.plan, "activityView");
  if (locked) {
    return (
      <div className="space-y-4">
        <UpgradePrompt error={locked} variant="inline" />
        <p className="max-w-2xl text-sm text-ink-muted">
          Every change on this project (assignments, requirements, uploads, approvals, expiries and status changes) is
          already being recorded. Upgrade to see the full history.
        </p>
      </div>
    );
  }

  const page = await loadProjectActivity(id);
  return (
    <SectionCard id="activity" icon={History} tone="neutral" title="Activity">
      {page.error && <Alert tone="error">Couldn&apos;t load the activity. Refresh to try again.</Alert>}
      {page.events.length === 0 && !page.error ? (
        <p className="py-6 text-center text-sm text-ink-muted">Activity appears here as things change on this project.</p>
      ) : (
        <ActivityFeed projectId={id} initial={page.events} initialCursor={page.nextCursor} />
      )}
    </SectionCard>
  );
}
