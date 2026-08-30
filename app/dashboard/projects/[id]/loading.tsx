import { Skeleton } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-28" />
        </div>
        <Skeleton className="h-4 w-52" />
      </div>
      <Skeleton className="h-24 rounded-card" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-40 rounded-card" />
      </div>
    </div>
  );
}
