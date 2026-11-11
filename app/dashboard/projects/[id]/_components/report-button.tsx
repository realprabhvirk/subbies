"use client";

import { useId, useState } from "react";
import { FileDown, Lock } from "lucide-react";

import { Button } from "@/app/components/button";
import { DialogFrame } from "@/app/components/dialog";
import { UpgradePrompt } from "@/app/components/upgrade-prompt";
import type { PlanError } from "@/lib/billing/plans";

/**
 * "Download PDF". On plans without reports it shows a lock and opens the
 * upgrade prompt (the server also refuses the route, this is only the UI).
 * Fetches rather than linking, so a refusal (rate limit, access) shows as a
 * message instead of downloading an error as a file.
 */
export function ReportButton({ projectId, locked }: { projectId: string; locked: PlanError | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const titleId = useId();

  if (locked) {
    return (
      <>
        <Button type="button" variant="secondary" onClick={() => setShowPrompt(true)}>
          <Lock className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          Download PDF
        </Button>
        {showPrompt && (
          <DialogFrame titleId={titleId} title="PDF compliance reports" onClose={() => setShowPrompt(false)} size="lg">
            <UpgradePrompt error={locked} variant="dialog" />
          </DialogFrame>
        )}
      </>
    );
  }

  const download = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/report`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Couldn't create the report. Try again.");
        return;
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "compliance-report.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError("Couldn't create the report. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" onClick={download} pending={pending}>
        <FileDown className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        Download PDF
      </Button>
      {error && <span role="alert" className="max-w-64 text-right text-xs text-expired">{error}</span>}
    </span>
  );
}
