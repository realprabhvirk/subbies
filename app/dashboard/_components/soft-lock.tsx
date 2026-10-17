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

      <div className="mt-12 max-w-2xl border-b border-line pb-8">
        <p className="label-caps flex items-center gap-1.5 text-ink-muted">
          <Lock className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          Plan inactive
        </p>
        <h1 className="mt-3 text-3xl sm:text-4xl">
          Your plan is no longer active
        </h1>
        <p className="mt-3 text-base text-ink-muted">
          Your account and everything in it are safe. Choose a plan to pick up
          exactly where you left off.
        </p>
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
