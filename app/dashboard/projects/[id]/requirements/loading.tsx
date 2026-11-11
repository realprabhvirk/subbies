import { Skeleton } from "@/app/components/skeleton";
import { CardRowsSkeleton } from "../../../_skeleton-parts";

/** Requirements list, then the add card. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <CardRowsSkeleton rows={4} />
      <Skeleton className="h-36 rounded-card" />
    </div>
  );
}
