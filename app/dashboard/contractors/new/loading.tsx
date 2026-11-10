import { Skeleton } from "@/app/components/skeleton";
import { HeaderSkeleton } from "../../_skeleton-parts";

/** Header, the two-step strip, then the details card. */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <HeaderSkeleton back action={false} />
      <div className="max-w-2xl space-y-5">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-9 rounded-none" />
          <Skeleton className="h-9 rounded-none" />
        </div>
        <Skeleton className="h-96 rounded-card" />
      </div>
    </div>
  );
}
