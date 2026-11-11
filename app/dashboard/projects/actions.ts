"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireActiveCompany } from "@/lib/billing/require-active";
import { canAddProject, limitMessage } from "@/lib/billing/entitlements";
import { rpcErrorMessage, subbiesRpcCode } from "@/lib/db/rpc-errors";
import type { ProjectStatus } from "@/lib/types";
import { recordProjectActivity } from "@/lib/projects/activity";
import { describeProjectEdit } from "@/lib/projects/activity-text";
import { syncAfterProjectChange } from "@/lib/projects/after-change";

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
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };
  const company = access.company;

  const limitCheck = await canAddProject(company.id);
  if (!limitCheck.allowed) {
    return { ok: false, error: limitMessage(limitCheck, "projects") };
  }

  const { data, state } = parseProjectForm(formData);
  if (state) return state;

  const supabase = await createClient();
  // create_project (migration 0020) re-checks access and the plan limit
  // under a lock; direct inserts are refused once Part B runs.
  const { data: newProjectId, error } = await supabase.rpc("create_project", {
    p_name: data!.name,
    p_address: data!.address,
    p_status: data!.status,
    p_start_date: data!.start_date,
    p_end_date: data!.end_date,
  });

  if (error) {
    if (subbiesRpcCode(error)) return { ok: false, error: rpcErrorMessage(error, "projects") };
    console.error("createProject failed", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't create the project. Try again." };
  }

  if (typeof newProjectId === "string") {
    await recordProjectActivity(supabase, {
      projectId: newProjectId,
      eventType: "project_created",
      description: `Created the project ${data!.name}`,
    });
  }

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateProject(
  _prev: ProjectFormState | null,
  formData: FormData,
): Promise<ProjectFormState> {
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };
  const company = access.company;

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing project reference." };

  const { data, state } = parseProjectForm(formData);
  if (state) return state;

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("projects")
    .select("name, address, status, start_date, end_date")
    .eq("id", id)
    .eq("company_id", company.id)
    .maybeSingle<{ name: string; address: string | null; status: ProjectStatus; start_date: string | null; end_date: string | null }>();
  if (!before) return { ok: false, error: "Couldn't find that project." };

  const { error } = await supabase
    .from("projects")
    .update(data!)
    .eq("id", id)
    .eq("company_id", company.id);

  if (error) {
    // Reopening a completed project is checked against the project limit
    // (the projects_reopen_guard trigger in migration 0021).
    if (subbiesRpcCode(error) === "SUBBIES_LIMIT_REACHED") {
      return {
        ok: false,
        error:
          "Reopening this project would put you over your plan's project limit. Complete another project first, or upgrade in Settings → Billing.",
      };
    }
    if (subbiesRpcCode(error) === "SUBBIES_NO_ACCESS") {
      return { ok: false, error: rpcErrorMessage(error, "projects") };
    }
    console.error("updateProject failed", error);
    return { ok: false, error: "Couldn't save the project. Try again." };
  }

  const edit = describeProjectEdit(before, data!);
  if (edit) {
    await recordProjectActivity(supabase, { projectId: id, eventType: edit.eventType, description: edit.description });
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
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };
  const company = access.company;

  const supabase = await createClient();

  // Confirm both the project and the contractor belong to this company.
  const [{ data: project }, { data: contractor }] = await Promise.all([
    supabase.from("projects").select("id").eq("id", projectId).eq("company_id", company.id).maybeSingle(),
    supabase.from("contractors").select("id, archived_at, business_name").eq("id", contractorId).eq("company_id", company.id).maybeSingle(),
  ]);

  if (!project || !contractor) return { ok: false, error: "Couldn't find that project or contractor." };
  if (contractor.archived_at) {
    return { ok: false, error: "That contractor is archived. Restore them before assigning them to a project." };
  }

  const trimmedRole = role.trim();
  if (trimmedRole.length > 120) return { ok: false, error: "Keep the role under 120 characters." };

  const { error } = await supabase.rpc("assign_project_contractor", {
    p_project_id: projectId,
    p_contractor_id: contractorId,
    p_role: trimmedRole || null,
  });

  if (error) {
    // Unique-index violation → already assigned.
    if (error.code === "23505") {
      return { ok: false, error: "That contractor is already on this project." };
    }
    if (subbiesRpcCode(error)) return { ok: false, error: rpcErrorMessage(error, "assignment") };
    console.error("assignContractor failed", error);
    return { ok: false, error: "Couldn't assign the contractor. Try again." };
  }

  await recordProjectActivity(supabase, {
    projectId,
    eventType: "contractor_assigned",
    description: `Assigned ${contractor.business_name ?? "a contractor"}${trimmedRole ? ` as ${trimmedRole}` : ""}`,
    contractorId,
  });
  // First sighting is stored silently; later changes are recorded.
  await syncAfterProjectChange(company.id, projectId);

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/contractors/${contractorId}`);
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function removeContractor(
  projectContractorId: string,
): Promise<{ ok: boolean; error?: string }> {
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };
  const company = access.company;

  const supabase = await createClient();

  // Scope: the assignment's project must belong to this company. RLS also
  // enforces this, but resolve ids for revalidation.
  const { data: row } = await supabase
    .from("project_contractors")
    .select("id, project_id, contractor_id, projects!inner(company_id), contractors(business_name)")
    .eq("id", projectContractorId)
    .maybeSingle<{
      id: string;
      project_id: string;
      contractor_id: string;
      projects: { company_id: string } | null;
      contractors: { business_name: string } | null;
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

  await recordProjectActivity(supabase, {
    projectId: row.project_id,
    eventType: "contractor_removed",
    description: `Removed ${row.contractors?.business_name ?? "a contractor"} from the project`,
    contractorId: row.contractor_id,
  });

  revalidatePath(`/dashboard/projects/${row.project_id}`);
  revalidatePath(`/dashboard/contractors/${row.contractor_id}`);
  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  return { ok: true };
}
