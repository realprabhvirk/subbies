import { Lock } from "lucide-react";

import { PLANS, PLAN_IDS } from "@/lib/billing/plans";
import { Logo } from "@/app/components/logo";
import { SignOutButton } from "./sign-out-button";
import { PlanSelection } from "@/app/onboarding/_components/plan-selection";

export function SoftLock() {
  const plans = PLAN_IDS.map((id) => ({
    id,
    name: PLANS[id].name,
    amount: PLANS[id].amount,
    blurb: PLANS[id].blurb,
    featured: PLANS[id].featured,
    features: PLANS[id].features,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex items-center justify-between">
        <Logo />
        <SignOutButton variant="inline" />
      </div>

      <div className="mt-10 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-subtle">
          <Lock className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold sm:text-3xl">
            Your plan is no longer active
          </h1>
          <p className="mt-2 text-ink-muted">
            Your account and everything in it are safe. Choose a plan to pick up
            exactly where you left off.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <PlanSelection
          plans={plans}
          heading="Choose a plan"
          intro="Billed monthly in AUD. Change or cancel any time. Have a code? Enter it at checkout."
        />
      </div>
    </main>
  );
}
