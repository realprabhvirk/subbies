import { Skeleton } from "@/app/components/skeleton";
import { CardRowsSkeleton, HeaderSkeleton, TabsSkeleton } from "../../_skeleton-parts";

/** Back link, title + status, contact line, tabs, then the document cards. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div>
        <HeaderSkeleton back action={false} />
        <Skeleton className="mt-5 h-5 w-96 max-w-full" />
      </div>
      <TabsSkeleton />
      <CardRowsSkeleton rows={2} />
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}
