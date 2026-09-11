"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Users, FileText, FolderKanban } from "lucide-react";

import { Alert } from "@/app/components/alert";
import { Button } from "@/app/components/button";
import { StatCard, type StatTone } from "@/app/components/card";
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
        <div className="rounded-md bg-surface-muted px-4 py-3 text-sm text-ink-muted">
          Checkout cancelled. No plan was started.
        </div>
      )}

      {entitlement.paidAccess ? (
        <div className="rounded-card border border-line bg-surface p-6">
          {entitlement.onTrial && !entitlement.cancelAtPeriodEnd && (
            <Alert tone="warning" className="mb-4">
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
            <Alert tone="error" className="mb-4">
              Your last payment didn&apos;t go through. Update your card to keep
              your {entitlement.planName} plan. We&apos;ll keep retrying for a few
              days.
            </Alert>
          )}

          {/* Plan name gets the same weight as a stat number — the price is
              real but secondary information, so it drops to a caption
              underneath rather than sharing the headline's line. */}
          <p className="font-display text-2xl font-semibold text-brand-ink">
            {entitlement.planName}
          </p>
          {entitlement.planAmount !== null && (
            <p className="mt-0.5 text-sm text-ink-muted">
              A${entitlement.planAmount}/month
            </p>
          )}
          <p className="mt-2 text-sm text-ink-muted">
            {entitlement.cancelAtPeriodEnd
              ? `Cancels ${fmt(entitlement.currentPeriodEnd)}. You keep access until then.`
              : entitlement.status === "past_due"
                ? "Payment overdue."
                : entitlement.onTrial
                  ? `Free trial. Your first payment is on ${fmt(entitlement.trialEndsAt)}.`
                  : `Renews ${fmt(entitlement.currentPeriodEnd)}.`}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
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
            <div className="mt-4 rounded-md border border-expired-line bg-expired-bg p-3">
              <p className="text-sm text-expired">
                Cancel your {entitlement.planName} plan? You&apos;ll keep access
                until {fmt(entitlement.currentPeriodEnd)}, then the account locks
                until you choose a plan again. Nothing is deleted.
              </p>
              <div className="mt-3 flex gap-2">
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
          <h3 className="text-sm font-semibold">Choose a plan</h3>
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
        <p className="rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
          {error}
        </p>
      )}

      <div>
        <p className="text-sm font-semibold">Usage</p>
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(Object.keys(RESOURCE_LABEL) as LimitedResource[]).map((r) => {
            const limit = limits[r];
            const used = usage[r];
            const atLimit = limit !== null && used >= limit;
            const tone: StatTone = atLimit ? "attention" : "neutral";
            return (
              <StatCard
                key={r}
                label={RESOURCE_LABEL[r]}
                value={used}
                icon={RESOURCE_ICON[r]}
                tone={tone}
                // A fraction against infinity ("1 / unlimited") reads oddly —
                // the count stands alone as the headline number, with the
                // ceiling (or lack of one) as a caption underneath instead.
                note={
                  limit === null
                    ? "No limit"
                    : atLimit
                      ? `Limit reached — ${limit} max`
                      : `of ${limit}`
                }
                share={limit !== null ? used / limit : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
