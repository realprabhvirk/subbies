import { Skeleton } from "@/app/components/skeleton";

/** Mirrors the dashboard: header, figures row, queue + side column. */
export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-3 border-b border-line pb-6">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid overflow-hidden rounded-card border border-line bg-surface sm:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-4 border-line p-6 [&:not(:first-child)]:border-t xl:[&:not(:first-child)]:border-l xl:[&:not(:first-child)]:border-t-0">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-28" />
        </div>
      </div>
    </div>
  );
}
