import Link from "next/link";
import { TriangleAlert } from "lucide-react";

/** Shown above a resource list when the company is at its plan limit. */
export function LimitBanner({
  resource,
  limit,
  accessLapsed = false,
}: {
  resource: string;
  limit: number | null;
  accessLapsed?: boolean;
}) {
  // A limit of 0 means the plan doesn't include this at all.
  const notIncluded = !accessLapsed && limit === 0;
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-attention-line bg-attention-bg/70 px-3.5 py-3 text-sm text-attention">
      <TriangleAlert className="mt-0.5 h-4.5 w-4.5 shrink-0" strokeWidth={2.25} aria-hidden />
      <span>
        {accessLapsed ? (
          <>Your access has ended. </>
        ) : notIncluded ? (
          <>
            {resource.charAt(0).toUpperCase() + resource.slice(1)} aren&apos;t
            included in your plan.{" "}
          </>
        ) : (
          <>
            You&apos;re at your plan&apos;s limit of {limit} {resource}.{" "}
          </>
        )}
        <Link
          href="/dashboard/settings?tab=billing"
          className="font-semibold underline underline-offset-2"
        >
          {accessLapsed ? "Choose a plan" : "Upgrade your plan"}
        </Link>{" "}
        {notIncluded ? "to use them." : "to add more."}
      </span>
    </div>
  );
}
