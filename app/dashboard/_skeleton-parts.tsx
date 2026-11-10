import { Skeleton } from "@/app/components/skeleton";

/** Title + subline (+ optional action button), the same block PageHeader renders. */
export function HeaderSkeleton({ action = true, back = false }: { action?: boolean; back?: boolean }) {
  return (
    <div>
      {back && <Skeleton className="mb-4 h-11 w-32" />}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
        <div className="space-y-3">
          <Skeleton className="h-11 w-64 max-w-full" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        {action && <Skeleton className="h-12 w-44" />}
      </div>
    </div>
  );
}

/** A SectionCard shell: disc + title header, then `rows` 64px rows. */
export function CardRowsSkeleton({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-card border border-line bg-surface shadow-sm ${className}`}>
      <div className="flex items-center gap-3.5 px-card pb-4 pt-card sm:px-6 sm:pt-6">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3.5 border-t border-line px-card py-3 sm:px-6">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3.5 w-64 max-w-full" />
          </div>
          <Skeleton className="hidden h-8 w-28 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

/** The underlined tab strip (contractor detail, settings). */
export function TabsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex h-12 items-center gap-6 shadow-[inset_0_-1px_0_var(--color-line)]">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-20" />
      ))}
    </div>
  );
}
