import { Skeleton } from "@/app/components/skeleton";
import { CardRowsSkeleton } from "../../_skeleton-parts";

/** Overview: four stat tiles, then needs attention (2/3) and recent activity (1/3). */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-card" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <CardRowsSkeleton rows={4} className="lg:col-span-2" />
        <CardRowsSkeleton rows={3} />
      </div>
    </div>
  );
}
