import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { canAddProject, getSubscriptionRow } from "@/lib/billing/entitlements";
import { can, isPlanId } from "@/lib/billing/plans";
import { computeProjectCompliance } from "@/lib/compliance/project";
import { loadComplianceInputs } from "@/lib/projects/compliance-data";
import { complianceToday } from "@/lib/time/compliance-today";
import type { ProjectStatus } from "@/lib/types";
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

  // Independent of the project queries below, so start it now and await later.
  const limitCheckPromise = canAddProject(company.id);

  const { data: projectData, error } = await supabase
    .from("projects")
    .select("id, name, address, status, start_date, end_date, created_at")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="rounded-md border border-expired-line bg-expired-bg/70 px-4 py-3 text-sm text-expired">
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

  // Compliance per project from the one engine (three queries for all of
  // them): issues = assigned contractors not cleared for that project.
  const counts = new Map<string, { total: number; issues: number }>();
  if (projects.length > 0) {
    const sub = await getSubscriptionRow(company.id);
    const plan = isPlanId(sub?.plan) ? sub!.plan : null;
    const { byProject } = await loadComplianceInputs(supabase, projects.map((p) => p.id));
    const now = complianceToday();
    for (const p of projects) {
      const inputs = byProject.get(p.id);
      if (!inputs) continue;
      const r = computeProjectCompliance({
        requirements: inputs.requirements,
        contractors: inputs.contractors,
        documents: inputs.documents,
        now,
        mode: can(plan, "requirements") ? "requirements" : "basic",
      });
      counts.set(p.id, { total: r.assignedCount, issues: r.assignedCount - r.clearedCount });
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

  const limitCheck = await limitCheckPromise;

  return (
    <ProjectsManager
      projects={items}
      atLimit={!limitCheck.allowed}
      limit={limitCheck.limit}
      planError={limitCheck.planError}
    />
  );
}
