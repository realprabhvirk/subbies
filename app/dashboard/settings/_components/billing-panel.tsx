"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Users, FileText, FolderKanban } from "lucide-react";

import { Alert } from "@/app/components/alert";
import { Button } from "@/app/components/button";
import { type StatTone } from "@/app/components/card";
import { PlanCards, type BillingPlan } from "@/app/components/plan-cards";
import type { SubscriptionStatus } from "@/lib/types";
import type { LimitedResource } from "@/lib/billing/plans";
import {
  startCheckout,
  openBillingPortal,
  cancelSubscription,
  resumeSubscription,
} from "../billing-actions";

export interface BillingEntitlementView {
  status: SubscriptionStatus;
  planName: string | null;
  planAmount: number | null;
  paidAccess: boolean;
  onTrial: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const RESOURCE_LABEL: Record<LimitedResource, string> = {
  contractors: "Contractors",
  documentTypes: "Document types",
  projects: "Projects",
};

const RESOURCE_ICON: Record<LimitedResource, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  contractors: Users,
  documentTypes: FileText,
  projects: FolderKanban,
};

function fmt(iso: string | null): string {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function daysUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(
    0,
    Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000),
  );
}

export function BillingPanel({
  entitlement,
  usage,
  limits,
  plans,
  checkout,
}: {
  entitlement: BillingEntitlementView;
  usage: Record<LimitedResource, number>;
  limits: Record<LimitedResource, number | null>;
  plans: BillingPlan[];
  checkout: "success" | "cancelled" | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const run = (
    name: string,
    fn: () => Promise<{ ok: boolean; url?: string; error?: string }>,
  ) => {
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

  const startPlanCheckout = (planId: BillingPlan["id"]) =>
    run(`checkout-${planId}`, () => startCheckout(planId));

  return (
    <div className="space-y-6">
      {checkout === "success" && (
        <Alert tone="success">
          {entitlement.onTrial
            ? "You're all set. Your free trial has started. Nothing has been charged."
            : "Your plan is active. Thanks for subscribing."}
        </Alert>
      )}
      {checkout === "cancelled" && (
        <Alert tone="info">Checkout cancelled. No plan was started.</Alert>
      )}

      {entitlement.paidAccess ? (
        <div className="rounded-card border border-line bg-surface p-5 sm:p-6">
          {entitlement.onTrial && !entitlement.cancelAtPeriodEnd && (
            // A trial is information, not a problem: info tone, not warning.
            <Alert tone="info" className="mb-5">
              You&apos;re on a free trial,{" "}
              <strong>
                {daysUntil(entitlement.trialEndsAt)}{" "}
                {daysUntil(entitlement.trialEndsAt) === 1 ? "day" : "days"} left
              </strong>
              . Your card is charged on {fmt(entitlement.trialEndsAt)} unless you
              cancel before then.
            </Alert>
          )}

          {entitlement.status === "past_due" && (
            <Alert tone="error" className="mb-5">
              Your last payment didn&apos;t go through. Update your card to keep
              your {entitlement.planName} plan. We&apos;ll keep retrying for a few
              days.
            </Alert>
          )}

          {/* Plan name gets the same weight as a stat number — the price is
              real but secondary information, so it drops to a caption
              underneath rather than sharing the headline's line. */}
          <p className="label-caps text-ink-muted">Current plan</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="font-display text-3xl font-bold tracking-display text-ink">
              {entitlement.planName}
            </p>
            {entitlement.planAmount !== null && (
              <p className="text-sm text-ink-muted">
                <span className="font-mono text-ink">A${entitlement.planAmount}</span> / month
              </p>
            )}
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            {entitlement.cancelAtPeriodEnd
              ? `Cancels ${fmt(entitlement.currentPeriodEnd)}. You keep access until then.`
              : entitlement.status === "past_due"
                ? "Payment overdue."
                : entitlement.onTrial
                  ? `Free trial. Your first payment is on ${fmt(entitlement.trialEndsAt)}.`
                  : `Renews ${fmt(entitlement.currentPeriodEnd)}.`}
          </p>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => run("portal", openBillingPortal)}
              disabled={pending}
              pending={busyAction === "portal"}
            >
              <CreditCard className="h-4 w-4" strokeWidth={2} aria-hidden />
              Manage billing
            </Button>

            {entitlement.cancelAtPeriodEnd ? (
              <Button
                type="button"
                onClick={() => run("resume", resumeSubscription)}
                disabled={pending}
                pending={busyAction === "resume"}
              >
                Keep my plan
              </Button>
            ) : (
              !confirmCancel && (
                <Button
                  type="button"
                  variant="danger-outline"
                  onClick={() => setConfirmCancel(true)}
                  disabled={pending}
                >
                  Cancel plan
                </Button>
              )
            )}
          </div>

          {confirmCancel && !entitlement.cancelAtPeriodEnd && (
            <div className="mt-4 rounded-md border border-expired-line bg-expired-bg/50 p-3 sm:p-4">
              <p className="text-sm text-expired">
                Cancel your {entitlement.planName} plan? You&apos;ll keep access
                until {fmt(entitlement.currentPeriodEnd)}, then the account locks
                until you choose a plan again. Nothing is deleted.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => run("cancel", cancelSubscription)}
                  disabled={pending}
                  pending={busyAction === "cancel"}
                >
                  Confirm cancellation
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmCancel(false)}
                  disabled={pending}
                >
                  Keep plan
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <h3 className="text-lg">Choose a plan</h3>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            Billed monthly in AUD. Change or cancel any time. Have a code? Enter
            it at checkout.
          </p>
          <div className="mt-4">
            <PlanCards
              plans={plans}
              onChoose={startPlanCheckout}
              busyPlanId={
                busyAction?.startsWith("checkout-")
                  ? (busyAction.slice("checkout-".length) as BillingPlan["id"])
                  : null
              }
              disabled={pending}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-expired-line bg-expired-bg/70 px-3 py-2 text-sm text-expired">
          {error}
        </p>
      )}

      <section aria-labelledby="usage-heading">
        <h3 id="usage-heading" className="label-caps text-ink-muted">
          Usage
        </h3>
        <div className="mt-3 grid overflow-hidden rounded-card border border-line bg-surface sm:grid-cols-3">
          {(Object.keys(RESOURCE_LABEL) as LimitedResource[]).map((r, i) => {
            const limit = limits[r];
            const used = usage[r];
            // 0 means the plan doesn't include this, which isn't the same as
            // having hit a cap.
            const notIncluded = limit === 0;
            const atLimit = limit !== null && limit > 0 && used >= limit;
            const tone: StatTone = atLimit ? "attention" : "neutral";
            const Icon = RESOURCE_ICON[r];
            return (
              <div
                key={r}
                className={`p-5 sm:p-6 ${i > 0 ? "border-t border-line sm:border-l sm:border-t-0" : ""}`}
              >
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Icon className="h-4 w-4 text-ink-subtle" strokeWidth={2} />
                  {RESOURCE_LABEL[r]}
                </p>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className={`figure text-3xl ${tone === "attention" ? "text-attention" : "text-ink"}`}>
                    {used}
                  </span>
                  {/* A fraction against infinity ("1 / unlimited") reads
                      oddly, so an unlimited ceiling is a caption instead. */}
                  <span className="text-sm text-ink-muted">
                    {limit === null
                      ? "· no limit"
                      : notIncluded
                        ? "· not in your plan"
                        : `/ ${limit}`}
                  </span>
                </p>
                {limit !== null && !notIncluded && (
                  <div aria-hidden className="mt-3 h-1 overflow-hidden rounded-full bg-line">
                    <div
                      className={`h-full ${atLimit ? "bg-attention" : "bg-ink-muted"}`}
                      style={{ width: `${Math.round(Math.min(1, used / limit) * 100)}%` }}
                    />
                  </div>
                )}
                {atLimit && (
                  <p className="mt-2 text-xs font-semibold text-attention">Limit reached</p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
