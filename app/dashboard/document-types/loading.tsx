import { Skeleton } from "@/app/components/skeleton";
import { HeaderSkeleton } from "../_skeleton-parts";

/** Header, then one card of rows. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton />
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-sm">
        <Skeleton className="hidden h-12 rounded-none xl:block" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex min-h-16 items-center gap-3.5 border-t border-line px-card py-3.5 first:border-t-0 sm:px-6">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-5 w-56 max-w-full" />
            <Skeleton className="ml-auto hidden h-7 w-40 rounded-full sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
