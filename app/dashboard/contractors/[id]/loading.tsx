import { Skeleton } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-sm">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 border-b border-line px-5 py-4 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-9 w-full max-w-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
