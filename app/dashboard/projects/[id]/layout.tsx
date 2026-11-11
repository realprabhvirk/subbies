import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarRange, MapPin } from "lucide-react";

import { PageHeader } from "@/app/components/page-header";
import { StatusBadge } from "@/app/components/status-badge";
import { can } from "@/lib/billing/plans";
import { getProjectBasics } from "./_lib/workspace";
import { EditProjectButton } from "./_components/edit-project-button";
import { ProjectTabs } from "./_components/project-tabs";
import { ComplianceFigure, ComplianceFigureSkeleton } from "./_components/compliance-figure";

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/**
 * The project workspace shell. Only the cheap project row is awaited here;
 * the compliance figure streams in behind its own Suspense boundary, and each
 * tab has its own loading skeleton, so a tab click never blanks the screen.
 */
export default async function ProjectLayout({ children, params }: LayoutProps<"/dashboard/projects/[id]">) {
  const { id } = await params;
  const basics = await getProjectBasics(id);
  if (!basics) notFound();
  const { project, plan } = basics;

  const dateRange =
    project.start_date || project.end_date
      ? [project.start_date ? fmtDate(project.start_date) : "–", project.end_date ? fmtDate(project.end_date) : "–"].join(" → ")
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/dashboard/projects", label: "Projects" }}
        eyebrow="Project"
        title={project.name}
        actions={
          <>
            <StatusBadge kind="project" status={project.status} />
            <EditProjectButton
              project={{
                id: project.id,
                name: project.name,
                address: project.address,
                status: project.status,
                startDate: project.start_date,
                endDate: project.end_date,
              }}
            />
          </>
        }
        meta={
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
            <div className="flex min-w-0 flex-wrap gap-x-6 gap-y-2 text-sm text-ink">
              {project.address && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" strokeWidth={2} aria-hidden />
                  <span className="min-w-0 break-words">{project.address}</span>
                </span>
              )}
              {dateRange && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarRange className="h-4 w-4 text-ink-subtle" strokeWidth={2} aria-hidden />
                  <span className="font-mono text-xs">{dateRange}</span>
                </span>
              )}
            </div>
            <Suspense fallback={<ComplianceFigureSkeleton />}>
              <ComplianceFigure projectId={project.id} />
            </Suspense>
          </div>
        }
      />

      <ProjectTabs
        projectId={project.id}
        tabs={[
          { segment: null, label: "Overview" },
          { segment: "contractors", label: "Contractors" },
          { segment: "requirements", label: "Requirements", locked: !can(plan, "requirements") },
          { segment: "documents", label: "Documents", locked: !can(plan, "documentRegister") },
          { segment: "activity", label: "Activity", locked: !can(plan, "activityView") },
        ]}
      />

      {children}
    </div>
  );
}
