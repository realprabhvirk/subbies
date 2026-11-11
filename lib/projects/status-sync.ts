/**
 * Keeps project_contractor_status in step with the compliance engine and
 * records compliance_status_changed exactly once per real change (the SQL
 * function compares against the last known status under a row lock).
 *
 * Called after anything that can change a contractor's standing on a project
 * (approve, reject, upload, assign, requirement edits) and from the daily job
 * for time-driven changes (a document crossing into "expiring" or "expired").
 * Best-effort: failures are logged, never thrown, and a missing 0022 is a
 * quiet no-op.
 */
import { computeProjectCompliance } from "../compliance/project.ts";
import { can, type PlanId } from "../billing/plans.ts";
import { complianceToday } from "../time/compliance-today.ts";
import { loadComplianceInputs } from "./compliance-data.ts";
import type { RpcClient } from "./activity.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = RpcClient & { from(table: string): any };

export interface StatusRow {
  project_id: string;
  contractor_id: string;
  status: string;
}

/** Engine output for these projects as ledger rows. Pure apart from the loader. */
export async function computeStatusRows(
  db: Db,
  projects: { id: string; plan: PlanId | null }[],
  now: Date = complianceToday(),
  onlyContractorId?: string,
): Promise<StatusRow[] | null> {
  const { byProject, error } = await loadComplianceInputs(db, projects.map((p) => p.id));
  if (error) {
    console.error("status sync: load failed", { error });
    return null;
  }
  const rows: StatusRow[] = [];
  for (const p of projects) {
    const inputs = byProject.get(p.id);
    if (!inputs) continue;
    const result = computeProjectCompliance({
      requirements: inputs.requirements,
      contractors: inputs.contractors,
      documents: inputs.documents,
      now,
      // Requirements only drive compliance on plans that include them; a
      // downgraded company keeps its requirements (D7) but sees basic mode.
      mode: can(p.plan, "requirements") ? "requirements" : "basic",
    });
    for (const c of result.contractors) {
      if (onlyContractorId && c.contractorId !== onlyContractorId) continue;
      rows.push({ project_id: p.id, contractor_id: c.contractorId, status: c.status });
    }
  }
  return rows;
}

function quiet(error: { code?: string; message?: string }) {
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}

/** Signed-in user: their company's projects. */
export async function syncProjectStatuses(
  db: Db,
  projects: { id: string; plan: PlanId | null }[],
  onlyContractorId?: string,
): Promise<void> {
  try {
    if (projects.length === 0) return;
    const rows = await computeStatusRows(db, projects, undefined, onlyContractorId);
    if (!rows || rows.length === 0) return;
    const { error } = await db.rpc("sync_project_statuses", { p_rows: rows });
    if (error && !quiet(error)) console.error("status sync failed", { code: error.code, message: error.message });
  } catch (err) {
    console.error("status sync threw", { err: String(err) });
  }
}

/** Service role (daily job, token uploads): one company at a time. */
export async function syncProjectStatusesAsServer(
  admin: Db,
  companyId: string,
  projects: { id: string; plan: PlanId | null }[],
  onlyContractorId?: string,
): Promise<number> {
  try {
    if (projects.length === 0) return 0;
    const rows = await computeStatusRows(admin, projects, undefined, onlyContractorId);
    if (!rows || rows.length === 0) return 0;
    const { data, error } = await admin.rpc("subbies_sync_project_statuses", {
      p_company_id: companyId,
      p_rows: rows,
      p_actor: null,
    });
    if (error) {
      if (!quiet(error)) console.error("status sync (server) failed", { companyId, code: error.code, message: error.message });
      return 0;
    }
    return Number(data ?? 0);
  } catch (err) {
    console.error("status sync (server) threw", { companyId, err: String(err) });
    return 0;
  }
}

/**
 * The open projects a contractor is assigned to, with the company's plan.
 * Completed projects are left alone: their history is settled.
 */
export async function projectsForContractor(
  db: Db,
  contractorId: string,
  plan: PlanId | null,
): Promise<{ id: string; plan: PlanId | null }[]> {
  const { data, error } = await db
    .from("project_contractors")
    .select("project_id, projects!inner(status)")
    .eq("contractor_id", contractorId)
    .is("removed_at", null)
    .neq("projects.status", "completed");
  if (error) return [];
  const ids = [...new Set(((data ?? []) as { project_id: string }[]).map((r) => r.project_id))];
  return ids.map((id) => ({ id, plan }));
}
