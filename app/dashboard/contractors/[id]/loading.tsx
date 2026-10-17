import { Skeleton } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-7 w-28" />
        </div>
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-4 border-b border-line pb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-16" />
        ))}
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 border-b border-line px-4 py-4 sm:px-5 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-7 w-24" />
              </div>
              <Skeleton className="h-9 w-full max-w-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
