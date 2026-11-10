import { Skeleton } from "@/app/components/skeleton";

/**
 * Mirrors the v4 dashboard: hero header (date, greeting, company line,
 * subline, button), the four stat tiles, then the two-column body (Needs you +
 * quick actions on the left, overview + expiring on the right). Same grid and
 * gaps as page.tsx so nothing moves when the real page arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-14 w-80 max-w-full" />
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-12 w-48" />
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-60 rounded-card sm:h-56" />
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-card border border-line bg-surface shadow-sm">
            <div className="flex items-center gap-3.5 px-card pb-4 pt-card sm:px-6 sm:pt-6">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex min-h-16 items-center gap-3.5 border-t border-line px-card py-3 sm:px-6">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="h-3.5 w-64 max-w-full" />
                </div>
                <Skeleton className="hidden h-8 w-28 rounded-full sm:block" />
              </div>
            ))}
          </div>
          <Skeleton className="h-60 rounded-card" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-96 rounded-card" />
          <Skeleton className="h-72 rounded-card" />
        </div>
      </div>
    </div>
  );
}
