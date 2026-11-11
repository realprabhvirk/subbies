"use client";

import { Check } from "lucide-react";

import { Button } from "@/app/components/button";
import type { PlanId } from "@/lib/billing/plans";

export interface BillingPlan {
  id: PlanId;
  name: string;
  amount: number;
  blurb: string;
  featured: boolean;
  /** Marketing tag on the featured plan, from PLAN_CONFIG. */
  tag?: string | null;
  features: string[];
  /** Announced, not live. Rendered with a "Coming soon" label, never as included. */
  comingSoon?: string[];
}

export function PlanCards({
  plans,
  onChoose,
  busyPlanId,
  disabled,
  ctaLabel = "Choose",
}: {
  plans: BillingPlan[];
  onChoose: (id: PlanId) => void;
  busyPlanId: PlanId | null;
  disabled?: boolean;
  ctaLabel?: string;
}) {
  // One rate card, three columns divided by rules — read across like a price
  // list, not three floating tiles. The featured plan is marked by a steel
  // bar along its top edge and a caps label, not by being bigger.
  return (
    <div className="grid overflow-hidden rounded-card border border-line bg-surface lg:grid-cols-3">
      {plans.map((plan, i) => (
        <div
          key={plan.id}
          className={`relative flex flex-col p-6 sm:p-7 ${
            i > 0 ? "border-t border-line lg:border-l lg:border-t-0" : ""
          } ${plan.featured ? "bg-brand-tint/40" : ""}`}
        >
          {plan.featured && (
            <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-brand" />
          )}
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-lg font-semibold">{plan.name}</h4>
            {plan.tag && <span className="label-caps text-brand">{plan.tag}</span>}
          </div>
          <p className="mt-1.5 min-h-12 text-sm text-ink-muted">{plan.blurb}</p>
          <p className="mt-5 flex items-baseline gap-1.5">
            <span className="figure text-5xl text-ink">A${plan.amount}</span>
            <span className="text-sm text-ink-muted">/ month</span>
          </p>
          <Button
            type="button"
            variant={plan.featured ? "primary" : "secondary"}
            onClick={() => onChoose(plan.id)}
            disabled={disabled}
            pending={busyPlanId === plan.id}
            className="mt-6"
            fullWidth
          >
            {ctaLabel} {plan.name}
          </Button>
          <ul className="mt-6 divide-y divide-line border-t border-line text-sm">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 py-2.5">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                  strokeWidth={2.5}
                  aria-hidden
                />
                <span className="text-ink">{f}</span>
              </li>
            ))}
            {(plan.comingSoon ?? []).map((f) => (
              <li key={f} className="flex items-start justify-between gap-3 py-2.5 text-ink-muted">
                <span>{f}</span>
                <span className="inline-flex shrink-0 items-center rounded-full border border-line bg-surface-muted px-2 py-0.5 text-2xs font-semibold">
                  Coming soon
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
