"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import type { ProjectStatus } from "@/lib/types";

const STATUSES: ProjectStatus[] = ["active", "on_hold", "completed"];

export interface ProjectFormState {
  ok: boolean;
  error?: string;
  fieldErrors?: {
    name?: string;
    address?: string;
    status?: string;
    dates?: string;
  };
}

function validDate(v: string): boolean {
  return v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function parseProjectForm(formData: FormData): {
  data?: {
    name: string;
    address: string | null;
    status: ProjectStatus;
    start_date: string | null;
    end_date: string | null;
  };
  state?: ProjectFormState;
} {
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const status = String(formData.get("status") ?? "active");
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();

  const fieldErrors: ProjectFormState["fieldErrors"] = {};
  if (!name) fieldErrors.name = "Give the project a name.";
  else if (name.length > 120) fieldErrors.name = "Keep it under 120 characters.";
  if (address.length > 250) fieldErrors.address = "Keep it under 250 characters.";
  if (!STATUSES.includes(status as ProjectStatus))
    fieldErrors.status = "Pick a valid status.";
  if (!validDate(startDate) || !validDate(endDate))
    fieldErrors.dates = "Dates must be valid.";
  else if (startDate && endDate && endDate < startDate)
    fieldErrors.dates = "The end date can't be before the start date.";

  if (Object.keys(fieldErrors).length > 0) return { state: { ok: false, fieldErrors } };

  return {
    data: {
      name,
      address: address || null,
      status: status as ProjectStatus,
      start_date: startDate || null,
      end_date: endDate || null,
    },
  };
}

export async function createProject(
  _prev: ProjectFormState | null,
  formData: FormData,
): Promise<ProjectFormState> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };

  const { data, state } = parseProjectForm(formData);
  if (state) return state;

  const supabase = await createClient();
  const { error } = await supabase.from("projects").insert({
    company_id: company.id,
    ...data!,
  });

  if (error) {
    console.error("createProject failed", error);
    return { ok: false, error: "Couldn't create the project. Try again." };
  }

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateProject(
  _prev: ProjectFormState | null,
  formData: FormData,
): Promise<ProjectFormState> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing project reference." };

  const { data, state } = parseProjectForm(formData);
  if (state) return state;

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update(data!)
    .eq("id", id)
    .eq("company_id", company.id);

  if (error) {
    console.error("updateProject failed", error);
    return { ok: false, error: "Couldn't save the project. Try again." };
  }

  revalidatePath("/dashboard/projects");
  revalidatePath(`/dashboard/projects/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function assignContractor(
  projectId: string,
  contractorId: string,
  role: string,
): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };

  const supabase = await createClient();

  // Confirm both the project and the contractor belong to this company.
  const [{ data: project }, { data: contractor }] = await Promise.all([
    supabase.from("projects").select("id").eq("id", projectId).eq("company_id", company.id).maybeSingle(),
    supabase.from("contractors").select("id").eq("id", contractorId).eq("company_id", company.id).maybeSingle(),
  ]);

  if (!project || !contractor) return { ok: false, error: "Couldn't find that project or contractor." };

  const { error } = await supabase.from("project_contractors").insert({
    project_id: projectId,
    contractor_id: contractorId,
    role_on_project: role.trim() || null,
  });

  if (error) {
    // Unique-index violation → already assigned.
    if (error.code === "23505") {
      return { ok: false, error: "That contractor is already on this project." };
    }
    console.error("assignContractor failed", error);
    return { ok: false, error: "Couldn't assign the contractor. Try again." };
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/contractors/${contractorId}`);
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeContractor(
  projectContractorId: string,
): Promise<{ ok: boolean; error?: string }> {
  const company = await getCompany();
  if (!company) return { ok: false, error: "Your session has expired. Reload and try again." };

  const supabase = await createClient();

  // Scope: the assignment's project must belong to this company. RLS also
  // enforces this, but resolve ids for revalidation.
  const { data: row } = await supabase
    .from("project_contractors")
    .select("id, project_id, contractor_id, projects!inner(company_id)")
    .eq("id", projectContractorId)
    .maybeSingle<{
      id: string;
      project_id: string;
      contractor_id: string;
      projects: { company_id: string } | null;
    }>();

  if (!row || row.projects?.company_id !== company.id) {
    return { ok: false, error: "Couldn't find that assignment." };
  }

  const { error } = await supabase
    .from("project_contractors")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", projectContractorId);

  if (error) {
    console.error("removeContractor failed", error);
    return { ok: false, error: "Couldn't remove the contractor. Try again." };
  }

  revalidatePath(`/dashboard/projects/${row.project_id}`);
  revalidatePath(`/dashboard/contractors/${row.contractor_id}`);
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  return { ok: true };
}
