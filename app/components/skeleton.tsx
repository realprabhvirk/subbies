export function Skeleton({ className = "" }: { className?: string }) {
  // A caller that passes its own radius (rounded-full, rounded-card) wins;
  // otherwise bars get the standard 14px.
  const radius = /(^|\s)rounded/.test(className) ? "" : "rounded-md";
  return (
    <div
      className={`animate-pulse bg-line/70 motion-reduce:animate-none ${radius} ${className}`}
      aria-hidden
    />
  );
}

/**
 * Generic dashboard page skeleton — a heading plus a few content blocks.
 * Shown instantly on navigation while the server component loads, so a cold
 * start reads as "loading" rather than "unresponsive".
 */
export function DashboardPageSkeleton({
  rows = 4,
  withStats = false,
}: {
  rows?: number;
  withStats?: boolean;
}) {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-11 w-72 max-w-full" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>

      {withStats && (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-card" />
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-sm">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-16 items-center justify-between gap-4 border-b border-line px-card py-3 sm:px-6 last:border-b-0"
          >
            <div className="flex items-center gap-3.5">
              <Skeleton className="h-11 w-11 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            </div>
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
