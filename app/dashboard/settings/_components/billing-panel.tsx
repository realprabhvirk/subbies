"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleCheck, TriangleAlert, CreditCard } from "lucide-react";

import { Spinner } from "@/app/components/spinner";
import type { PlanId } from "@/lib/billing/plans";
import type { SubscriptionStatus } from "@/lib/types";
import {
  startCheckout,
  openBillingPortal,
  cancelSubscription,
  resumeSubscription,
} from "../billing-actions";

export interface BillingPlan {
  id: PlanId;
  name: string;
  amount: number;
  blurb: string;
  features: string[];
}

export interface BillingEntitlementView {
  status: SubscriptionStatus;
  plan: PlanId | null;
  planName: string | null;
  hasAccess: boolean;
  inGoodStanding: boolean;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function BillingPanel({
  entitlement,
  usage,
  plans,
  freeLimit,
  checkout,
}: {
  entitlement: BillingEntitlementView;
  usage: { used: number; limit: number | null };
  plans: BillingPlan[];
  freeLimit: number;
  checkout: "success" | "cancelled" | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const currentPlan = plans.find((p) => p.id === entitlement.plan) ?? null;

  const run = (name: string, fn: () => Promise<{ ok: boolean; url?: string; error?: string }>) => {
    setError(null);
    setBusyAction(name);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong. Try again.");
        setBusyAction(null);
        return;
      }
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      setBusyAction(null);
      setConfirmCancel(false);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {checkout === "success" && (
        <div className="flex items-start gap-2 rounded-md bg-approved-bg px-4 py-3 text-sm text-approved">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>
            Your plan is set up and your 14-day free trial has started. You can
            cancel any time before it ends.
          </span>
        </div>
      )}
      {checkout === "cancelled" && (
        <div className="rounded-md bg-surface-muted px-4 py-3 text-sm text-ink-muted">
          Checkout cancelled — no plan was started.
        </div>
      )}

      {/* Current state */}
      {!entitlement.hasAccess ? (
        <div>
          <h3 className="text-sm font-semibold">Choose a plan</h3>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            Every plan includes a 14-day free trial. Your card is added now and
            charged when the trial ends — cancel before then and you won&apos;t
            be charged.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-col rounded-card border border-line bg-surface p-5"
              >
                <h4 className="text-base font-semibold">{plan.name}</h4>
                <p className="mt-1 text-sm text-ink-muted">{plan.blurb}</p>
                <p className="mt-3">
                  <span className="text-2xl font-semibold text-brand-ink">
                    A${plan.amount}
                  </span>
                  <span className="text-sm text-ink-muted">/month</span>
                </p>
                <button
                  type="button"
                  onClick={() => run(`checkout-${plan.id}`, () => startCheckout(plan.id))}
                  disabled={pending}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
                >
                  {busyAction === `checkout-${plan.id}` && <Spinner className="h-4 w-4" />}
                  Start 14-day trial
                </button>
                <ul className="mt-5 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-approved" strokeWidth={2.5} aria-hidden />
                      <span className="text-ink-muted">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-card border border-line bg-surface p-6">
          {(entitlement.status === "past_due" || entitlement.status === "unpaid") && (
            <div className="mb-4 flex items-start gap-2 rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span>
                Your last payment didn&apos;t go through. Update your card to keep
                your {entitlement.planName} plan — we&apos;ll keep retrying for a
                few days.
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {entitlement.status === "trialing" ? "Free trial" : entitlement.planName}
                {currentPlan && (
                  <span className="font-normal text-ink-muted">
                    {" "}
                    — A${currentPlan.amount}/month
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {entitlement.status === "trialing" && !entitlement.cancelAtPeriodEnd && (
                  <>
                    Trial ends {fmt(entitlement.trialEnd)}. Your card is charged
                    A${currentPlan?.amount}/month from then unless you cancel.
                  </>
                )}
                {entitlement.status === "trialing" && entitlement.cancelAtPeriodEnd && (
                  <>
                    Set to cancel when the trial ends on {fmt(entitlement.trialEnd)}
                    — you won&apos;t be charged.
                  </>
                )}
                {entitlement.status === "active" && !entitlement.cancelAtPeriodEnd && (
                  <>Renews {fmt(entitlement.currentPeriodEnd)}.</>
                )}
                {entitlement.status === "active" && entitlement.cancelAtPeriodEnd && (
                  <>
                    Cancels {fmt(entitlement.currentPeriodEnd)}. You keep access
                    until then.
                  </>
                )}
                {(entitlement.status === "past_due" ||
                  entitlement.status === "unpaid") && (
                  <>Payment overdue.</>
                )}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => run("portal", openBillingPortal)}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:opacity-60"
            >
              {busyAction === "portal" ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <CreditCard className="h-4 w-4" strokeWidth={2} aria-hidden />
              )}
              Manage billing
            </button>

            {entitlement.cancelAtPeriodEnd ? (
              <button
                type="button"
                onClick={() => run("resume", resumeSubscription)}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
              >
                {busyAction === "resume" && <Spinner className="h-4 w-4" />}
                Keep my plan
              </button>
            ) : (
              !confirmCancel && (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  disabled={pending}
                  className="rounded-md px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-expired disabled:opacity-60"
                >
                  Cancel plan
                </button>
              )
            )}
          </div>

          {confirmCancel && !entitlement.cancelAtPeriodEnd && (
            <div className="mt-4 rounded-md border border-expired-line bg-expired-bg p-3">
              <p className="text-sm text-expired">
                Cancel your {entitlement.planName} plan? You&apos;ll keep access
                until{" "}
                {entitlement.status === "trialing"
                  ? fmt(entitlement.trialEnd)
                  : fmt(entitlement.currentPeriodEnd)}
                , then drop to the free limit of {freeLimit} contractors. Nothing
                is deleted.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => run("cancel", cancelSubscription)}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-expired px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {busyAction === "cancel" && <Spinner className="h-3.5 w-3.5" />}
                  Confirm cancellation
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCancel(false)}
                  disabled={pending}
                  className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-muted"
                >
                  Keep plan
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
          {error}
        </p>
      )}

      {/* Usage */}
      <div className="rounded-card border border-line bg-surface p-5">
        <p className="text-sm font-semibold">Contractor usage</p>
        <p className="mt-1 text-sm text-ink-muted">
          {usage.used} of{" "}
          {usage.limit === null ? "unlimited" : usage.limit} contractors
          {usage.limit !== null && usage.used >= usage.limit && (
            <span className="font-medium text-attention"> — limit reached</span>
          )}
        </p>
      </div>
    </div>
  );
}
