"use client";

import { useState, useTransition } from "react";

import { PlanCards, type BillingPlan } from "@/app/components/plan-cards";
import { startCheckout } from "@/app/dashboard/settings/billing-actions";

export function PlanSelection({
  plans,
  heading,
  intro,
}: {
  plans: BillingPlan[];
  heading: string;
  intro: string;
}) {
  const [pending, startTransition] = useTransition();
  const [busyPlanId, setBusyPlanId] = useState<BillingPlan["id"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choosePlan = (planId: BillingPlan["id"]) => {
    setError(null);
    setBusyPlanId(planId);
    startTransition(async () => {
      const result = await startCheckout(planId);
      if (!result.ok || !result.url) {
        setError(result.error ?? "Couldn't start checkout. Try again.");
        setBusyPlanId(null);
        return;
      }
      window.location.assign(result.url);
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{heading}</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">{intro}</p>
      </div>

      <PlanCards
        plans={plans}
        onChoose={choosePlan}
        busyPlanId={busyPlanId}
        disabled={pending}
        ctaLabel="Start"
      />

      {error && (
        <p className="rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
          {error}
        </p>
      )}
    </div>
  );
}
