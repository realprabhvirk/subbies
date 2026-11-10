import { Skeleton } from "@/app/components/skeleton";
import { CardRowsSkeleton, HeaderSkeleton } from "../../_skeleton-parts";

/** Back link, title + actions, meta line, the assign card, the contractors card. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div>
        <HeaderSkeleton back />
        <Skeleton className="mt-5 h-5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-36 rounded-card" />
      <CardRowsSkeleton rows={3} />
    </div>
  );
}
