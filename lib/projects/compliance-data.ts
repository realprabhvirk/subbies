/**
 * Loads what the compliance engine needs for one or more projects, in three
 * queries however many contractors there are (no N+1):
 *
 *   1. active assignments with their contractors   } in parallel
 *   2. the projects' requirements                   }
 *   3. live documents for those contractors
 *
 * Works with either the signed-in client (RLS scopes it to the company) or
 * the service-role client (the daily job), which is why every query is also
 * filtered by project id: the caller passes ids it already resolved for the
 * right company.
 */
import type {
  EngineContractor,
  EngineDocument,
  EngineRequirement,
} from "../compliance/project.ts";
import type { ContractorStatus, DocumentStatus } from "../types.ts";

/** The parts of the Supabase query builder this uses. Loose so tests can fake it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from(table: string): any };

export interface AssignedRow {
  assignmentId: string;
  projectId: string;
  contractorId: string;
  roleOnProject: string | null;
  assignedAt: string;
  email: string | null;
}

export interface ProjectComplianceInputs {
  requirements: EngineRequirement[];
  contractors: EngineContractor[];
  assignments: AssignedRow[];
  documents: EngineDocument[];
  /** Assignments whose contractor is archived (hidden, but still assigned). */
  archivedAssigned: number;
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (error.code === "42P01" || error.code === "PGRST205" || /does not exist|could not find the table/i.test(error.message ?? "")));
}

export async function loadComplianceInputs(
  db: Db,
  projectIds: string[],
): Promise<{ byProject: Map<string, ProjectComplianceInputs>; error: string | null }> {
  const byProject = new Map<string, ProjectComplianceInputs>();
  for (const id of projectIds) {
    byProject.set(id, { requirements: [], contractors: [], assignments: [], documents: [], archivedAssigned: 0 });
  }
  if (projectIds.length === 0) return { byProject, error: null };

  const [assignRes, reqRes] = await Promise.all([
    db
      .from("project_contractors")
      .select("id, project_id, contractor_id, role_on_project, assigned_at, contractors(id, business_name, trade, status, email, archived_at)")
      .in("project_id", projectIds)
      .is("removed_at", null)
      .order("assigned_at", { ascending: true }),
    db
      .from("project_requirements")
      .select("id, project_id, document_type_id, is_mandatory, min_days_valid, created_at, document_types(name)")
      .in("project_id", projectIds)
      .order("created_at", { ascending: true }),
  ]);

  if (assignRes.error) return { byProject, error: "assignments" };
  // Before migration 0022 there are no requirements: basic mode everywhere.
  if (reqRes.error && !isMissingTable(reqRes.error)) return { byProject, error: "requirements" };

  type A = {
    id: string; project_id: string; contractor_id: string; role_on_project: string | null; assigned_at: string;
    contractors: { id: string; business_name: string; trade: string | null; status: ContractorStatus; email: string | null; archived_at?: string | null } | null;
  };
  const contractorIds = new Set<string>();
  for (const a of (assignRes.data ?? []) as A[]) {
    const slot = byProject.get(a.project_id);
    if (!slot || !a.contractors) continue;
    const archived = Boolean(a.contractors.archived_at);
    if (archived) {
      slot.archivedAssigned += 1;
      continue;
    }
    contractorIds.add(a.contractor_id);
    slot.assignments.push({
      assignmentId: a.id,
      projectId: a.project_id,
      contractorId: a.contractor_id,
      roleOnProject: a.role_on_project,
      assignedAt: a.assigned_at,
      email: a.contractors.email,
    });
    slot.contractors.push({
      id: a.contractors.id,
      businessName: a.contractors.business_name,
      trade: a.contractors.trade,
      status: a.contractors.status,
      archived: false,
    });
  }

  type R = { id: string; project_id: string; document_type_id: string; is_mandatory: boolean; min_days_valid: number | null; document_types: { name: string } | null };
  for (const r of ((reqRes.error ? [] : reqRes.data) ?? []) as R[]) {
    byProject.get(r.project_id)?.requirements.push({
      id: r.id,
      documentTypeId: r.document_type_id,
      documentTypeName: r.document_types?.name ?? "Document",
      isMandatory: r.is_mandatory,
      minDaysValid: r.min_days_valid,
    });
  }

  if (contractorIds.size > 0) {
    const docRes = await db
      .from("contractor_documents")
      .select("id, contractor_id, document_type_id, status, expiry_date, created_at, updated_at, document_types(name)")
      .in("contractor_id", [...contractorIds])
      // History rows are records, never evidence of compliance.
      .is("archived_at", null);
    if (docRes.error) return { byProject, error: "documents" };

    type D = { id: string; contractor_id: string; document_type_id: string; status: DocumentStatus; expiry_date: string | null; created_at: string; updated_at: string | null; document_types: { name: string } | null };
    const docs: EngineDocument[] = ((docRes.data ?? []) as D[]).map((d) => ({
      id: d.id,
      contractorId: d.contractor_id,
      documentTypeId: d.document_type_id,
      documentTypeName: d.document_types?.name ?? "Document",
      status: d.status,
      expiryDate: d.expiry_date,
      createdAt: d.created_at,
      updatedAt: d.updated_at ?? d.created_at,
    }));
    for (const slot of byProject.values()) {
      const ids = new Set(slot.contractors.map((c) => c.id));
      slot.documents = docs.filter((d) => ids.has(d.contractorId));
    }
  }

  return { byProject, error: null };
}
