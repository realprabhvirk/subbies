"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireActiveCompany } from "@/lib/billing/require-active";
import { getSubscriptionRow } from "@/lib/billing/entitlements";
import { featureError, isPlanId, type PlanError } from "@/lib/billing/plans";
import { rpcErrorMessage, subbiesRpcCode } from "@/lib/db/rpc-errors";
import { syncAfterProjectChange } from "@/lib/projects/after-change";
import { resendDocumentRequests } from "@/app/dashboard/contractors/[id]/manage-actions";
import { resendOnboardingRequest } from "@/app/dashboard/contractors/actions";

export type WorkspaceResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; planError?: PlanError | null };

function revalidateProject(projectId: string) {
  revalidatePath(`/dashboard/projects/${projectId}`, "layout");
  revalidatePath("/dashboard/projects");
}

function parseMinDays(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 3650) return "invalid";
  return n;
}

/** The server's answer on the requirements feature: a typed error when the plan lacks it. */
async function requirementsGate(companyId: string): Promise<WorkspaceResult | null> {
  const sub = await getSubscriptionRow(companyId);
  const plan = isPlanId(sub?.plan) ? sub!.plan : null;
  const err = featureError(plan, "requirements");
  if (!err) return null;
  return { ok: false, error: "Project requirements aren't included in your plan.", planError: err };
}

export async function addRequirement(
  projectId: string,
  documentTypeId: string,
  isMandatory: boolean,
  minDaysValid: number | string | null,
): Promise<WorkspaceResult> {
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };
  const gate = await requirementsGate(access.company.id);
  if (gate) return gate;
  const min = parseMinDays(minDaysValid);
  if (min === "invalid") return { ok: false, error: "Enter a number of days between 0 and 3650, or leave it blank." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_project_requirement", {
    p_project_id: projectId,
    p_document_type_id: documentTypeId,
    p_is_mandatory: Boolean(isMandatory),
    p_min_days_valid: min,
  });
  if (error) {
    if (subbiesRpcCode(error)) return { ok: false, error: rpcErrorMessage(error, "requirements") };
    console.error("addRequirement failed", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't add that requirement. Try again." };
  }
  await syncAfterProjectChange(access.company.id, projectId);
  revalidateProject(projectId);
  return { ok: true };
}

export async function updateRequirement(
  projectId: string,
  requirementId: string,
  isMandatory: boolean,
  minDaysValid: number | string | null,
): Promise<WorkspaceResult> {
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };
  const gate = await requirementsGate(access.company.id);
  if (gate) return gate;
  const min = parseMinDays(minDaysValid);
  if (min === "invalid") return { ok: false, error: "Enter a number of days between 0 and 3650, or leave it blank." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_project_requirement", {
    p_requirement_id: requirementId,
    p_is_mandatory: Boolean(isMandatory),
    p_min_days_valid: min,
  });
  if (error) {
    if (subbiesRpcCode(error)) return { ok: false, error: rpcErrorMessage(error, "requirements") };
    console.error("updateRequirement failed", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't save that change. Try again." };
  }
  await syncAfterProjectChange(access.company.id, projectId);
  revalidateProject(projectId);
  return { ok: true };
}

/** Removing only relaxes compliance, so it works on any plan (D7). */
export async function removeRequirement(projectId: string, requirementId: string): Promise<WorkspaceResult> {
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_project_requirement", { p_requirement_id: requirementId });
  if (error) {
    if (subbiesRpcCode(error)) return { ok: false, error: rpcErrorMessage(error, "requirements") };
    console.error("removeRequirement failed", { code: error.code, message: error.message });
    return { ok: false, error: "Couldn't remove that requirement. Try again." };
  }
  await syncAfterProjectChange(access.company.id, projectId);
  revalidateProject(projectId);
  return { ok: true };
}

/**
 * "Request" on a missing, expired or rejected requirement. Uses the existing
 * request flow (one email, cooldown, daily cap): if the contractor has never
 * been asked for this document type, a request row is added first.
 * Without a document type (basic mode) it resends their onboarding request.
 */
export async function requestProjectDocument(
  projectId: string,
  contractorId: string,
  documentTypeId: string | null,
): Promise<WorkspaceResult> {
  const access = await requireActiveCompany();
  if (!access.ok) return { ok: false, error: access.error };
  const company = access.company;
  const supabase = await createClient();

  // The contractor must be on this project, in this company, and not archived.
  const { data: assignment } = await supabase
    .from("project_contractors")
    .select("id, projects!inner(company_id), contractors!inner(company_id, archived_at)")
    .eq("project_id", projectId)
    .eq("contractor_id", contractorId)
    .is("removed_at", null)
    .maybeSingle<{ id: string; projects: { company_id: string }; contractors: { company_id: string; archived_at: string | null } }>();
  if (!assignment || assignment.projects.company_id !== company.id || assignment.contractors.company_id !== company.id) {
    return { ok: false, error: "That contractor isn't on this project." };
  }
  if (assignment.contractors.archived_at) {
    return { ok: false, error: "This contractor is archived. Restore them before sending requests." };
  }

  if (!documentTypeId) {
    const r = await resendOnboardingRequest(contractorId);
    revalidateProject(projectId);
    return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.message };
  }

  const { data: type } = await supabase
    .from("document_types")
    .select("id")
    .eq("id", documentTypeId)
    .eq("company_id", company.id)
    .maybeSingle();
  if (!type) return { ok: false, error: "Couldn't find that document type." };

  const { data: existing } = await supabase
    .from("contractor_documents")
    .select("id, status, replaces_document_id, created_at")
    .eq("contractor_id", contractorId)
    .eq("document_type_id", documentTypeId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  const rows = (existing ?? []) as { id: string; status: string; replaces_document_id: string | null }[];

  if (rows.some((d) => d.status === "uploaded")) {
    return { ok: false, error: "They've already uploaded this. It's waiting for your review." };
  }

  // Prefer the live requirement row (not a pending replacement); resend
  // decides what to do with it (re-ask, or add a replacement for an
  // approved copy).
  let target = rows.find((d) => d.replaces_document_id === null && d.status !== "revoked")?.id ?? rows[0]?.id ?? null;
  if (!target) {
    const { data: inserted, error } = await supabase
      .from("contractor_documents")
      .insert({ contractor_id: contractorId, document_type_id: documentTypeId, status: "requested" })
      .select("id")
      .single();
    if (error || !inserted) {
      console.error("requestProjectDocument: request insert failed", { code: error?.code });
      return { ok: false, error: "Couldn't create the request. Try again." };
    }
    target = inserted.id as string;
  }

  const result = await resendDocumentRequests(contractorId, [target]);
  revalidateProject(projectId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, message: "Request sent." };
}
