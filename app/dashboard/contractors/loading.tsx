import { Skeleton } from "@/app/components/skeleton";
import { HeaderSkeleton } from "../_skeleton-parts";

/** Header, the status filter chips, then the row list. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-32 rounded-full" />
        ))}
      </div>
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex min-h-16 items-center gap-3.5 border-b border-line px-card py-3.5 last:border-b-0 sm:px-6">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3.5 w-64 max-w-full" />
            </div>
            <Skeleton className="hidden h-8 w-44 rounded-full md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
