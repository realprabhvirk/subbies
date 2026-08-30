import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { hasComplianceIssue } from "@/lib/projects";
import type { ContractorStatus, ProjectStatus } from "@/lib/types";
import {
  ProjectsManager,
  type ProjectListItem,
} from "./_components/projects-manager";

export const metadata: Metadata = { title: "Projects" };

const STATUS_ORDER: Record<ProjectStatus, number> = {
  active: 0,
  on_hold: 1,
  completed: 2,
};

export default async function ProjectsPage() {
  const company = await getCompany();
  if (!company) return null;

  const supabase = await createClient();

  const { data: projectData, error } = await supabase
    .from("projects")
    .select("id, name, address, status, start_date, end_date, created_at")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="rounded-md bg-expired-bg px-4 py-3 text-sm text-expired">
          We couldn&apos;t load your projects. Refresh to try again.
        </p>
      </div>
    );
  }

  const projects = (projectData ?? []) as {
    id: string;
    name: string;
    address: string | null;
    status: ProjectStatus;
    start_date: string | null;
    end_date: string | null;
  }[];

  // Active assignments + the assigned contractor's status, in one query.
  const counts = new Map<string, { total: number; issues: number }>();
  if (projects.length > 0) {
    const { data: assignments } = await supabase
      .from("project_contractors")
      .select("project_id, contractors(status)")
      .in(
        "project_id",
        projects.map((p) => p.id),
      )
      .is("removed_at", null);

    for (const row of (assignments ?? []) as unknown as {
      project_id: string;
      contractors: { status: ContractorStatus } | null;
    }[]) {
      const entry = counts.get(row.project_id) ?? { total: 0, issues: 0 };
      entry.total += 1;
      if (row.contractors && hasComplianceIssue(row.contractors.status)) {
        entry.issues += 1;
      }
      counts.set(row.project_id, entry);
    }
  }

  const items: ProjectListItem[] = projects
    .map((p) => {
      const c = counts.get(p.id) ?? { total: 0, issues: 0 };
      return {
        id: p.id,
        name: p.name,
        address: p.address,
        status: p.status,
        startDate: p.start_date,
        endDate: p.end_date,
        contractorCount: c.total,
        issueCount: c.issues,
      };
    })
    .sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
    );

  return <ProjectsManager projects={items} />;
}
