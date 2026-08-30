"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";

import { StatusBadge } from "@/app/components/status-badge";
import { Spinner } from "@/app/components/spinner";
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
    <div className="space-y-4">
      <div className="rounded-card border border-line bg-surface p-5">
        <h3 className="text-sm font-semibold">Assign a contractor</h3>
        {available.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
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
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1 space-y-1">
              <label htmlFor="assign-pick" className="block text-xs font-medium text-ink-muted">
                Contractor
              </label>
              <select
                id="assign-pick"
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                className="w-full rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
              >
                <option value="">Select…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName}
                    {c.trade ? ` — ${c.trade}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[10rem] flex-1 space-y-1">
              <label htmlFor="assign-role" className="block text-xs font-medium text-ink-muted">
                Role <span className="font-normal">(optional)</span>
              </label>
              <input
                id="assign-role"
                type="text"
                maxLength={80}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Electrical"
                className="w-full rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
              />
            </div>
            <button
              type="button"
              onClick={assign}
              disabled={pending || !pick}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
            >
              {pending && !removingId ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" strokeWidth={2} aria-hidden />
              )}
              Assign
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-expired">{error}</p>}
      </div>

      {assigned.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-5 py-8 text-center text-sm text-ink-muted">
          No contractors assigned to this project yet.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {assigned.map((a) => (
            <li
              key={a.projectContractorId}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <Link
                  href={`/dashboard/contractors/${a.contractorId}`}
                  className="font-medium hover:text-brand hover:underline"
                >
                  {a.businessName}
                </Link>
                <p className="truncate text-sm text-ink-muted">
                  {[a.roleOnProject ?? a.trade].filter(Boolean).join(" · ") ||
                    "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge kind="contractor" status={a.status} />
                <button
                  type="button"
                  onClick={() => remove(a.projectContractorId)}
                  disabled={pending}
                  className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-expired-bg hover:text-expired disabled:opacity-60"
                  aria-label={`Remove ${a.businessName} from this project`}
                >
                  {removingId === a.projectContractorId ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" strokeWidth={2} />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {assigned.some((a) => hasComplianceIssue(a.status)) && (
        <p className="text-xs text-ink-subtle">
          Contractors marked anything other than “Approved” have an outstanding
          compliance issue — open the contractor to see what&apos;s missing.
        </p>
      )}
    </div>
  );
}
