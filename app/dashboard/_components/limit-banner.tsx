import Link from "next/link";
import { Lock } from "lucide-react";

/**
 * Shown above a resource list when the company can't add more because its
 * access has lapsed (or, as a fallback, when a limit has no typed error).
 * A plan limit renders an UpgradePrompt instead. Navy-tinted, not amber:
 * amber means compliance status.
 */
export function LimitBanner({
  resource,
  limit,
  accessLapsed = false,
}: {
  resource: string;
  limit: number | null;
  accessLapsed?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-brand-tint-line bg-brand-tint px-3.5 py-3 text-sm text-ink">
      <Lock className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand" strokeWidth={2.25} aria-hidden />
      <span>
        {accessLapsed ? (
          <>Your access has ended. </>
        ) : (
          <>
            You&apos;re at your plan&apos;s limit of {limit} {resource}.{" "}
          </>
        )}
        <Link
          href="/dashboard/settings?tab=billing"
          className="font-semibold text-brand underline underline-offset-2"
        >
          {accessLapsed ? "Choose a plan" : "See plans"}
        </Link>{" "}
        to add more {resource}.
      </span>
    </div>
  );
}
