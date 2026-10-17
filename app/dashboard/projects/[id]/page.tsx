import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin, CalendarRange } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { StatusBadge } from "@/app/components/status-badge";
import { PageHeader } from "@/app/components/page-header";
import { Alert } from "@/app/components/alert";
import { projectIssueCount, type AssignedContractor } from "@/lib/projects";
import type { ContractorStatus, ProjectStatus } from "@/lib/types";
import { EditProjectButton } from "./_components/edit-project-button";
import {
  ProjectContractorsPanel,
  type AvailableContractor,
} from "./_components/project-contractors-panel";

export const metadata: Metadata = { title: "Project" };

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso + "T00:00:00"));
}

export default async function ProjectDetailPage(
  props: PageProps<"/dashboard/projects/[id]">,
) {
  const { id } = await props.params;
  const company = await getCompany();
  if (!company) return null;

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, address, status, start_date, end_date")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle<{
      id: string;
      name: string;
      address: string | null;
      status: ProjectStatus;
      start_date: string | null;
      end_date: string | null;
    }>();

  if (!project) notFound();

  const [{ data: assignmentRows }, { data: allContractors }] = await Promise.all([
    supabase
      .from("project_contractors")
      .select(
        "id, contractor_id, role_on_project, assigned_at, contractors(business_name, trade, status)",
      )
      .eq("project_id", project.id)
      .is("removed_at", null)
      .order("assigned_at", { ascending: true }),
    supabase
      .from("contractors")
      .select("id, business_name, trade, status")
      .eq("company_id", company.id)
      .order("business_name", { ascending: true }),
  ]);

  const assigned: AssignedContractor[] = (
    (assignmentRows ?? []) as unknown as {
      id: string;
      contractor_id: string;
      role_on_project: string | null;
      assigned_at: string;
      contractors: {
        business_name: string;
        trade: string | null;
        status: ContractorStatus;
      } | null;
    }[]
  ).map((r) => ({
    projectContractorId: r.id,
    contractorId: r.contractor_id,
    businessName: r.contractors?.business_name ?? "Contractor",
    trade: r.contractors?.trade ?? null,
    roleOnProject: r.role_on_project,
    status: r.contractors?.status ?? "pending",
    assignedAt: r.assigned_at,
  }));

  const assignedIds = new Set(assigned.map((a) => a.contractorId));
  const available: AvailableContractor[] = (
    (allContractors ?? []) as {
      id: string;
      business_name: string;
      trade: string | null;
      status: ContractorStatus;
    }[]
  )
    .filter((c) => !assignedIds.has(c.id))
    .map((c) => ({
      id: c.id,
      businessName: c.business_name,
      trade: c.trade,
      status: c.status,
    }));

  const issues = projectIssueCount(assigned);
  const dateRange =
    project.start_date || project.end_date
      ? [
          project.start_date ? fmtDate(project.start_date) : "–",
          project.end_date ? fmtDate(project.end_date) : "–",
        ].join(" → ")
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/dashboard/projects", label: "Projects" }}
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
          (project.address || dateRange) && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink">
              {project.address && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-ink-subtle" strokeWidth={2} aria-hidden />
                  {project.address}
                </span>
              )}
              {dateRange && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarRange className="h-4 w-4 text-ink-subtle" strokeWidth={2} aria-hidden />
                  <span className="font-mono text-xs">{dateRange}</span>
                </span>
              )}
            </div>
          )
        }
      />

      {issues > 0 && (
        <Alert tone="warning">
          {issues} of {assigned.length} assigned{" "}
          {assigned.length === 1 ? "contractor" : "contractors"} on this project{" "}
          {issues === 1 ? "isn't" : "aren't"} fully compliant.
        </Alert>
      )}
      {issues === 0 && assigned.length > 0 && (
        <Alert tone="success">
          Every contractor assigned to this project is approved.
        </Alert>
      )}

      <section>
        <h2 className="text-lg">Contractors on this project</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Assign the contractors working here and check their compliance before
          they&apos;re on site.
        </p>
        <div className="mt-4">
          <ProjectContractorsPanel
            projectId={project.id}
            assigned={assigned}
            available={available}
          />
        </div>
      </section>
    </div>
  );
}
