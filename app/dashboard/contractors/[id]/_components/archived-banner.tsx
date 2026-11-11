"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";

import { Button } from "@/app/components/button";
import { UpgradePrompt } from "@/app/components/upgrade-prompt";
import type { PlanError } from "@/lib/billing/plans";
import { restoreContractor } from "../manage-actions";

/**
 * Top of an archived contractor's page: says plainly what archiving means
 * and offers Restore. If the plan is full, the server's typed error comes
 * back and renders the one UpgradePrompt for the page.
 */
export function ArchivedBanner({
  contractorId,
  name,
  archivedLabel,
}: {
  contractorId: string;
  name: string;
  archivedLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<PlanError | null>(null);

  const restore = () => {
    setError(null);
    setPlanError(null);
    startTransition(async () => {
      const result = await restoreContractor(contractorId);
      if (!result.ok) {
        setError(result.error);
        setPlanError(result.planError ?? null);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-line-strong bg-surface-muted p-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <Archive className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" strokeWidth={2} aria-hidden />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Archived {archivedLabel}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {name} is off your register. They don&apos;t count towards your plan, get no
                reminders, and their upload link shows as no longer active. Their documents,
                notes and history are kept.
              </p>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={restore} disabled={pending} className="shrink-0">
            {pending ? "Restoring…" : "Restore contractor"}
          </Button>
        </div>
        {error && !planError && (
          <p role="alert" className="mt-3 text-sm text-expired">
            {error}
          </p>
        )}
        {planError && (
          <p role="status" className="mt-3 text-sm text-ink-muted">
            {error}
          </p>
        )}
      </div>
      {planError && <UpgradePrompt error={planError} />}
    </div>
  );
}
