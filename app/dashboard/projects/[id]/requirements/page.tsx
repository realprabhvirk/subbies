import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { UpgradePrompt } from "@/app/components/upgrade-prompt";
import { canAddDocumentType } from "@/lib/billing/entitlements";
import { featureError } from "@/lib/billing/plans";
import { getProjectWorkspace } from "../_lib/workspace";
import { RequirementsManager, type RequirementView } from "../_components/requirements-manager";

export const metadata: Metadata = { title: "Project requirements" };

export default async function ProjectRequirementsPage(props: PageProps<"/dashboard/projects/[id]/requirements">) {
  const { id } = await props.params;
  const ws = await getProjectWorkspace(id);
  if (!ws) return null;

  const locked = featureError(ws.plan, "requirements");
  if (locked) {
    const kept = ws.inputs.requirements.length;
    return (
      <div className="space-y-4">
        <UpgradePrompt error={locked} variant="inline" />
        <p className="max-w-2xl text-sm text-ink-muted">
          Requirements let you choose which document types each project needs, mark them mandatory or optional,
          and set how long a document must stay valid. Each contractor is then checked against this project&apos;s
          list rather than their overall status.
          {kept > 0 &&
            ` This project's ${kept} ${kept === 1 ? "requirement is" : "requirements are"} kept and apply again if you upgrade.`}
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: types }, typeLimit] = await Promise.all([
    supabase.from("document_types").select("id, name").eq("company_id", ws.company.id).order("name", { ascending: true }),
    canAddDocumentType(ws.company.id),
  ]);

  const requiredIds = new Set(ws.inputs.requirements.map((r) => r.documentTypeId));
  const requirements: RequirementView[] = ws.inputs.requirements.map((r) => ({
    id: r.id,
    documentTypeName: r.documentTypeName,
    isMandatory: r.isMandatory,
    minDaysValid: r.minDaysValid,
    covered: ws.compliance.contractors.filter((c) =>
      c.cells.some((cell) => cell.requirementId === r.id && (cell.state === "valid" || cell.state === "expiring")),
    ).length,
    assigned: ws.compliance.assignedCount,
  }));

  return (
    <RequirementsManager
      projectId={ws.project.id}
      requirements={requirements}
      availableTypes={((types ?? []) as { id: string; name: string }[]).filter((t) => !requiredIds.has(t.id))}
      canCreateType={typeLimit.allowed}
    />
  );
}
