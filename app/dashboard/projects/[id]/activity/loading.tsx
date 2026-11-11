import { Skeleton } from "@/app/components/skeleton";

/** Day heading, then timeline rows. */
export default function Loading() {
  return (
    <div className="rounded-card border border-line bg-surface p-card shadow-sm sm:p-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="mt-6 h-3.5 w-20" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="mt-4 flex gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
