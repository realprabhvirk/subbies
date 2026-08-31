"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Spinner } from "@/app/components/spinner";
import { PlanCards, type BillingPlan } from "@/app/components/plan-cards";
import { startCheckout } from "@/app/dashboard/settings/billing-actions";
import { startFreeAccess } from "@/app/onboarding/actions";

export function PlanSelection({
  plans,
  allowFree,
}: {
  plans: BillingPlan[];
  /** Show the "continue with free access" option (first-time onboarding only). */
  allowFree: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choosePlan = (planId: BillingPlan["id"]) => {
    setError(null);
    setBusy(`plan-${planId}`);
    startTransition(async () => {
      const result = await startCheckout(planId);
      if (!result.ok || !result.url) {
        setError(result.error ?? "Couldn't start checkout. Try again.");
        setBusy(null);
        return;
      }
      window.location.assign(result.url);
    });
  };

  const chooseFree = () => {
    setError(null);
    setBusy("free");
    startTransition(async () => {
      const result = await startFreeAccess();
      // startFreeAccess redirects on success; only reached on error.
      if (result && !result.ok) {
        setError(result.error ?? "Something went wrong. Try again.");
        setBusy(null);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      {allowFree && (
        <div className="rounded-card border border-brand/30 bg-brand-tint/40 p-6">
          <h2 className="text-base font-semibold text-brand-ink">
            Start with 7 days free
          </h2>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            Full access to everything — no card required. We&apos;ll remind you
            before it ends, and nothing is deleted if you don&apos;t upgrade in
            time.
          </p>
          <button
            type="button"
            onClick={chooseFree}
            disabled={pending}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {busy === "free" ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
            )}
            Continue with free access
          </button>
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold">
          {allowFree ? "Or choose a plan now" : "Choose a plan"}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Billed monthly in AUD. Change or cancel any time. Have a code? Enter it
          at checkout.
        </p>
        <div className="mt-4">
          <PlanCards
            plans={plans}
            onChoose={choosePlan}
            busyPlanId={
              busy?.startsWith("plan-")
                ? (busy.slice("plan-".length) as BillingPlan["id"])
                : null
            }
            disabled={pending}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
          {error}
        </p>
      )}
    </div>
  );
}
