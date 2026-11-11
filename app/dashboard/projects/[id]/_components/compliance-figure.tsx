import { getProjectWorkspace } from "../_lib/workspace";

/**
 * The project's compliance as one big number and a bar, next to the title.
 * Async, rendered inside a Suspense boundary in the layout so the header and
 * tabs paint first.
 */
export async function ComplianceFigure({ projectId }: { projectId: string }) {
  const ws = await getProjectWorkspace(projectId);
  if (!ws) return null;
  const { percent, clearedCount, assignedCount } = ws.compliance;

  if (percent === null) {
    return <p className="text-sm text-ink-muted">No contractors assigned</p>;
  }
  return (
    <div className="w-full max-w-64" aria-label={`Project compliance ${percent}%, ${clearedCount} of ${assignedCount} contractors cleared`}>
      <div className="flex items-baseline gap-2">
        <span className="figure text-5xl text-ink">{percent}%</span>
        <span className="text-sm text-ink-muted">compliant</span>
      </div>
      <div aria-hidden className="mt-2 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1.5 font-mono text-xs text-ink-muted">
        {clearedCount} of {assignedCount} cleared
      </p>
    </div>
  );
}

export function ComplianceFigureSkeleton() {
  return (
    <div className="w-56 space-y-2" aria-hidden>
      <div className="h-12 w-28 animate-pulse rounded-md bg-surface-muted" />
      <div className="h-2 w-full animate-pulse rounded-full bg-surface-muted" />
    </div>
  );
}
