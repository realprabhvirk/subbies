import Link from "next/link";
import { Check, Lock } from "lucide-react";

import { ButtonLink } from "@/app/components/button";
import { PLAN_CONFIG, type PlanError } from "@/lib/billing/plans";
import { promptCopy } from "@/lib/billing/upgrade-copy";

/** Where "Upgrade" goes: the existing billing flow. */
export const BILLING_HREF = "/dashboard/settings?tab=billing";
const COMPARE_HREF = "/pricing";

/**
 * The one upgrade prompt. Always rendered from the typed error the server
 * returned (PLAN_LIMIT or PLAN_FEATURE): the UI never decides entitlement.
 * Show at most one per page.
 *
 * - `inline`: a card in the page flow (a gated feature's slot).
 * - `limit`: the same card, worded for a count limit (contractors, projects).
 * - `dialog`: no card chrome, for placing inside an existing Dialog.
 *
 * The lock disc is navy-tinted on purpose: red, amber and green mean
 * compliance status, never "you need to pay".
 */
export function UpgradePrompt({
  error,
  variant = error.code === "PLAN_LIMIT" ? "limit" : "inline",
  className = "",
}: {
  error: PlanError;
  variant?: "inline" | "dialog" | "limit";
  className?: string;
}) {
  const copy = promptCopy(error);
  if (!copy) return null;
  const plan = PLAN_CONFIG[copy.plan];

  const body = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <span
        aria-hidden
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-tint-line bg-brand-tint text-brand"
      >
        <Lock className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-card-title text-ink">{copy.title}</h2>
        <p className="mt-1 text-sm text-ink-muted">{copy.why}</p>
        <ul className="mt-4 space-y-2 text-sm text-ink">
          {copy.bullets.map((b) => (
            <li key={b} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <ButtonLink href={BILLING_HREF}>Upgrade to {plan.name}</ButtonLink>
          <span className="font-mono text-xs text-ink-muted">
            A${plan.amount} / month
          </span>
          <Link
            href={COMPARE_HREF}
            className="text-sm font-medium text-brand underline-offset-4 hover:underline"
          >
            Compare plans
          </Link>
        </div>
      </div>
    </div>
  );

  if (variant === "dialog") return <div className={className}>{body}</div>;
  return (
    <section
      aria-label={copy.title}
      className={`rounded-card border border-brand-tint-line bg-surface p-card shadow-sm sm:p-6 ${className}`}
    >
      {body}
    </section>
  );
}
