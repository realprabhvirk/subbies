import { Skeleton } from "@/app/components/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-full max-w-sm" />
      <Skeleton className="h-52 rounded-card" />
      <Skeleton className="h-40 rounded-card" />
    </div>
  );
}
