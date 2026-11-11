import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { getProjectWorkspace } from "../_lib/workspace";
import { ProjectContractorsPanel, type AvailableContractor, type WorkspaceAssigned } from "../_components/project-contractors-panel";
import type { ContractorStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Project contractors" };

export default async function ProjectContractorsPage(props: PageProps<"/dashboard/projects/[id]/contractors">) {
  const { id } = await props.params;
  const ws = await getProjectWorkspace(id);
  if (!ws) return null;

  const supabase = await createClient();
  const { data: all } = await supabase
    .from("contractors")
    .select("id, business_name, trade, status")
    .eq("company_id", ws.company.id)
    .is("archived_at", null)
    .order("business_name", { ascending: true });

  const byId = new Map(ws.compliance.contractors.map((c) => [c.contractorId, c]));
  const contractorById = new Map(ws.inputs.contractors.map((c) => [c.id, c]));
  const assigned: WorkspaceAssigned[] = ws.inputs.assignments.map((a) => {
    const c = contractorById.get(a.contractorId)!;
    const result = byId.get(a.contractorId);
    return {
      projectContractorId: a.assignmentId,
      contractorId: a.contractorId,
      businessName: c.businessName,
      trade: c.trade,
      roleOnProject: a.roleOnProject,
      status: c.status,
      assignedAt: a.assignedAt,
      projectStatus: result?.status ?? "not_cleared",
      mandatoryMet: result?.mandatoryMet ?? 0,
      mandatoryTotal: result?.mandatoryTotal ?? 0,
      cells: (result?.cells ?? []).map((cell) => ({ name: cell.documentTypeName, state: cell.state, mandatory: cell.isMandatory })),
    };
  });

  const assignedIds = new Set(assigned.map((a) => a.contractorId));
  const available: AvailableContractor[] = ((all ?? []) as { id: string; business_name: string; trade: string | null; status: ContractorStatus }[])
    .filter((c) => !assignedIds.has(c.id))
    .map((c) => ({ id: c.id, businessName: c.business_name, trade: c.trade, status: c.status }));

  return (
    <div className="space-y-4">
      <ProjectContractorsPanel projectId={ws.project.id} assigned={assigned} available={available} />
      {ws.inputs.archivedAssigned > 0 && (
        <p className="text-sm text-ink-muted">
          {ws.inputs.archivedAssigned} archived {ws.inputs.archivedAssigned === 1 ? "contractor is" : "contractors are"} hidden
          from this project. Restoring a contractor brings their assignment back.
        </p>
      )}
    </div>
  );
}
