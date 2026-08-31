"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, TriangleAlert, CreditCard, Clock } from "lucide-react";

import { Spinner } from "@/app/components/spinner";
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
  onFreeTier: boolean;
  freeEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const RESOURCE_LABEL: Record<LimitedResource, string> = {
  contractors: "Contractors",
  documentTypes: "Document types",
  projects: "Projects",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
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
        <div className="flex items-start gap-2 rounded-md bg-approved-bg px-4 py-3 text-sm text-approved">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>Your plan is active. Thanks for subscribing.</span>
        </div>
      )}
      {checkout === "cancelled" && (
        <div className="rounded-md bg-surface-muted px-4 py-3 text-sm text-ink-muted">
          Checkout cancelled — no plan was started.
        </div>
      )}

      {entitlement.paidAccess ? (
        <div className="rounded-card border border-line bg-surface p-6">
          {entitlement.status === "past_due" && (
            <div className="mb-4 flex items-start gap-2 rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span>
                Your last payment didn&apos;t go through. Update your card to keep
                your {entitlement.planName} plan — we&apos;ll keep retrying for a
                few days.
              </span>
            </div>
          )}

          <p className="text-sm font-semibold">
            {entitlement.planName}
            {entitlement.planAmount !== null && (
              <span className="font-normal text-ink-muted">
                {" "}
                — A${entitlement.planAmount}/month
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {entitlement.cancelAtPeriodEnd
              ? `Cancels ${fmt(entitlement.currentPeriodEnd)}. You keep access until then.`
              : entitlement.status === "past_due"
                ? "Payment overdue."
                : `Renews ${fmt(entitlement.currentPeriodEnd)}.`}
          </p>

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
                until {fmt(entitlement.currentPeriodEnd)}, then the account locks
                until you choose a plan again. Nothing is deleted.
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
      ) : (
        <div>
          {entitlement.onFreeTier && (
            <div className="mb-4 flex items-start gap-2 rounded-md bg-attention-bg px-4 py-3 text-sm text-attention">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span>
                You&apos;re on free access —{" "}
                <strong>
                  {daysUntil(entitlement.freeEndsAt)}{" "}
                  {daysUntil(entitlement.freeEndsAt) === 1 ? "day" : "days"} left
                </strong>
                . Choose a plan to keep going. Your data stays as it is.
              </span>
            </div>
          )}
          <h3 className="text-sm font-semibold">Choose a plan</h3>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            You&apos;re charged today. Change or cancel any time. Have a code?
            Enter it at checkout.
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
        <p className="rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
          {error}
        </p>
      )}

      <div className="rounded-card border border-line bg-surface p-5">
        <p className="text-sm font-semibold">Usage</p>
        <dl className="mt-2 space-y-1.5 text-sm">
          {(Object.keys(RESOURCE_LABEL) as LimitedResource[]).map((r) => {
            const limit = limits[r];
            const used = usage[r];
            const atLimit = limit !== null && used >= limit;
            return (
              <div key={r} className="flex justify-between">
                <dt className="text-ink-muted">{RESOURCE_LABEL[r]}</dt>
                <dd className={atLimit ? "font-medium text-attention" : "text-ink"}>
                  {used} / {limit === null ? "unlimited" : limit}
                  {atLimit && " — limit reached"}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}
