import { Skeleton } from "@/app/components/skeleton";
import { CardRowsSkeleton } from "../../../_skeleton-parts";

/** The assign card, then the contractors list. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-36 rounded-card" />
      <CardRowsSkeleton rows={5} />
    </div>
  );
}
