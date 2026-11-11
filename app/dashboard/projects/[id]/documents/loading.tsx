import { Skeleton } from "@/app/components/skeleton";

/** Filter chips, then the register table. */
export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-28 rounded-full" />
        ))}
      </div>
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-sm">
        <Skeleton className="h-11 rounded-none" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-line px-4 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-28 rounded-full" />
            <Skeleton className="ml-auto h-9 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
