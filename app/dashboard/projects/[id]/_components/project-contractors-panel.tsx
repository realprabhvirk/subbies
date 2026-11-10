"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, Users, X } from "lucide-react";

import { StatusBadge } from "@/app/components/status-badge";
import { SectionCard } from "@/app/components/section-card";
import { ListRow, RowList } from "@/app/components/list-row";
import { Avatar } from "@/app/components/avatar";
import { Button } from "@/app/components/button";
import { IconButton } from "@/app/components/icon-button";
import { fieldClasses } from "@/app/components/input";
import { hasComplianceIssue, type AssignedContractor } from "@/lib/projects";
import type { ContractorStatus } from "@/lib/types";
import { assignContractor, removeContractor } from "../../actions";

export interface AvailableContractor {
  id: string;
  businessName: string;
  trade: string | null;
  status: ContractorStatus;
}

export function ProjectContractorsPanel({
  projectId,
  assigned,
  available,
}: {
  projectId: string;
  assigned: AssignedContractor[];
  available: AvailableContractor[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [role, setRole] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const assign = () => {
    if (!pick) return;
    setError(null);
    startTransition(async () => {
      const result = await assignContractor(projectId, pick, role);
      if (!result.ok) {
        setError(result.error ?? "Couldn't assign that contractor.");
        return;
      }
      setPick("");
      setRole("");
      router.refresh();
    });
  };

  const remove = (projectContractorId: string) => {
    setError(null);
    setRemovingId(projectContractorId);
    startTransition(async () => {
      const result = await removeContractor(projectContractorId);
      if (!result.ok) {
        setError(result.error ?? "Couldn't remove that contractor.");
        setRemovingId(null);
        return;
      }
      setRemovingId(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <SectionCard id="assign" icon={UserPlus} tone="brand" title="Assign a contractor">
        {available.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Every contractor you have is already on this project.{" "}
            <Link
              href="/dashboard/contractors/new"
              className="font-medium text-brand hover:underline"
            >
              Add another contractor
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[12rem] flex-1 space-y-1.5">
              <label htmlFor="assign-pick" className="block text-xs font-semibold text-ink">
                Contractor
              </label>
              <select
                id="assign-pick"
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className={fieldClasses()}
              >
                <option value="">Select…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName}
                    {c.trade ? ` (${c.trade})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[10rem] flex-1 space-y-1.5">
              <label htmlFor="assign-role" className="block text-xs font-semibold text-ink">
                Role <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <input
                id="assign-role"
                type="text"
                maxLength={80}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Electrical"
                className={fieldClasses()}
              />
            </div>
            <Button
              type="button"
              onClick={assign}
              disabled={!pick}
              pending={pending && !removingId}
            >
              <UserPlus className="h-5 w-5" strokeWidth={2} aria-hidden />
              Assign
            </Button>
          </div>
        )}
        {error && <p className="mt-3 text-sm font-medium text-expired">{error}</p>}
      </SectionCard>

      <SectionCard
        id="on-project"
        icon={Users}
        tone="pending"
        title="Contractors on this project"
        subtitle="Check their compliance before they're on site."
        flush={assigned.length > 0}
      >
        {assigned.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-card py-8 text-center text-sm text-ink-muted">
            No contractors assigned to this project yet.
          </p>
        ) : (
          <RowList>
            {assigned.map((a) => (
              <ListRow
                key={a.projectContractorId}
                href={`/dashboard/contractors/${a.contractorId}`}
                leading={<Avatar name={a.businessName} />}
                title={a.businessName}
                meta={[a.roleOnProject ?? a.trade].filter(Boolean).join(" · ") || "–"}
                footer={<StatusBadge kind="contractor" status={a.status} size="sm" />}
                trailing={<StatusBadge kind="contractor" status={a.status} />}
                actions={
                  <IconButton
                    tone="danger"
                    onClick={() => remove(a.projectContractorId)}
                    disabled={pending}
                    pending={removingId === a.projectContractorId}
                    aria-label={`Remove ${a.businessName} from this project`}
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </IconButton>
                }
              />
            ))}
          </RowList>
        )}
      </SectionCard>

      {assigned.some((a) => hasComplianceIssue(a.status)) && (
        <p className="text-xs text-ink-muted">
          Contractors marked anything other than “Approved” have an outstanding
          compliance issue. Open the contractor to see what&apos;s missing.
        </p>
      )}
    </div>
  );
}
