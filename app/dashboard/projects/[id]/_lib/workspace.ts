import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { getSubscriptionRow } from "@/lib/billing/entitlements";
import { can, isPlanId, type PlanId } from "@/lib/billing/plans";
import { computeProjectCompliance, type ProjectCompliance } from "@/lib/compliance/project";
import { loadComplianceInputs, type ProjectComplianceInputs } from "@/lib/projects/compliance-data";
import { complianceToday } from "@/lib/time/compliance-today";
import type { ProjectStatus } from "@/lib/types";

export interface ProjectBasics {
  company: { id: string; name: string };
  plan: PlanId | null;
  project: {
    id: string;
    name: string;
    address: string | null;
    status: ProjectStatus;
    start_date: string | null;
    end_date: string | null;
  };
}

/**
 * The project row and the company's plan: one light query, shared by the
 * layout header and every tab in the same request (React cache).
 */
export const getProjectBasics = cache(async (id: string): Promise<ProjectBasics | null> => {
  const company = await getCompany();
  if (!company) return null;
  const supabase = await createClient();
  const [{ data: project }, sub] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, address, status, start_date, end_date")
      .eq("id", id)
      .eq("company_id", company.id)
      .maybeSingle<ProjectBasics["project"]>(),
    getSubscriptionRow(company.id),
  ]);
  if (!project) return null;
  return { company: { id: company.id, name: company.name }, plan: isPlanId(sub?.plan) ? sub!.plan : null, project };
});

export interface ProjectWorkspace extends ProjectBasics {
  inputs: ProjectComplianceInputs;
  compliance: ProjectCompliance;
  loadError: boolean;
}

/**
 * Everything the compliance figures need, computed once per request by the
 * one engine. Requirements only count on plans that include them; a
 * downgraded company keeps its requirements (D7) and sees basic mode.
 */
export const getProjectWorkspace = cache(async (id: string): Promise<ProjectWorkspace | null> => {
  const basics = await getProjectBasics(id);
  if (!basics) return null;
  const supabase = await createClient();
  const { byProject, error } = await loadComplianceInputs(supabase, [id]);
  const inputs = byProject.get(id)!;
  const compliance = computeProjectCompliance({
    requirements: inputs.requirements,
    contractors: inputs.contractors,
    documents: inputs.documents,
    now: complianceToday(),
    mode: can(basics.plan, "requirements") ? "requirements" : "basic",
  });
  return { ...basics, inputs, compliance, loadError: Boolean(error) };
});
