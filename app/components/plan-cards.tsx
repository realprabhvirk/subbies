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
  features: string[];
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
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      {plans.map((plan) => (
        <div
          key={plan.id}
          className={`flex flex-col rounded-card border bg-surface p-6 ${
            plan.featured
              ? "border-brand shadow-sm ring-1 ring-brand/20 lg:-my-2 lg:py-8"
              : "border-line"
          }`}
        >
          {plan.featured && (
            <span className="mb-3 inline-flex w-fit rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand-ink">
              Most popular
            </span>
          )}
          <h4 className="text-base font-semibold">{plan.name}</h4>
          <p className="mt-1 text-sm text-ink-muted">{plan.blurb}</p>
          <p className="mt-3">
            <span className="text-3xl font-semibold text-brand-ink">
              A${plan.amount}
            </span>
            <span className="text-sm text-ink-muted">/month</span>
          </p>
          <Button
            type="button"
            variant={plan.featured ? "primary" : "secondary"}
            onClick={() => onChoose(plan.id)}
            disabled={disabled}
            pending={busyPlanId === plan.id}
            className="mt-4"
          >
            {ctaLabel} {plan.name}
          </Button>
          <ul className="mt-5 space-y-2 text-sm">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-approved"
                  strokeWidth={2.5}
                  aria-hidden
                />
                <span className="text-ink-muted">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
