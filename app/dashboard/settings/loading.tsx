import { Skeleton } from "@/app/components/skeleton";
import { HeaderSkeleton, TabsSkeleton } from "../_skeleton-parts";

/** Header, the three tabs, then the form card and the document types card. */
export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton action={false} />
      <TabsSkeleton count={3} />
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-96 rounded-card" />
        <Skeleton className="h-24 rounded-card" />
      </div>
    </div>
  );
}
