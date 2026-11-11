import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUser, getCompany } from "@/lib/supabase/dal";
import { getEntitlement } from "@/lib/billing/entitlements";
import { hasUsedTrial } from "@/lib/billing/trial-eligibility";
import { PLANS, PLAN_IDS, TRIAL_DAYS } from "@/lib/billing/plans";
import { Logo } from "@/app/components/logo";
import { AuthShell } from "@/app/components/auth-shell";
import { Alert } from "@/app/components/alert";
import { SignOutButton } from "@/app/dashboard/_components/sign-out-button";
import { PlanSelection } from "./_components/plan-selection";

export const metadata: Metadata = { title: "Get started" };

export default async function OnboardingPage(
  props: PageProps<"/onboarding">,
) {
  const user = await requireUser();
  const company = await getCompany();

  if (!company) redirect("/dashboard"); // layout shows the recovery state

  const entitlement = await getEntitlement(company.id);
  if (!entitlement.needsOnboarding) redirect("/dashboard");

  // Told upfront, before checkout, rather than a surprise on the Stripe page —
  // see lib/billing/trial-eligibility.ts. The same check runs again (and is
  // the one that's actually enforced) inside startCheckout.
  const noTrial = user.email ? await hasUsedTrial(user.email) : false;

  const sp = await props.searchParams;
  const cancelled = sp.checkout === "cancelled";

  const plans = PLAN_IDS.map((id) => ({
    id,
    name: PLANS[id].name,
    amount: PLANS[id].amount,
    blurb: PLANS[id].blurb,
    featured: PLANS[id].featured,
    features: PLANS[id].features,
    tag: PLANS[id].tag,
    comingSoon: PLANS[id].comingSoon,
  }));

  return (
    <AuthShell wide>
    <div className="mx-auto w-full max-w-5xl px-(--page-padding) py-6 sm:py-8">
      <div className="flex items-center justify-between">
        <Logo size="brand" />
        <SignOutButton variant="inline" />
      </div>

      <div className="mt-14 max-w-2xl border-b border-line pb-8 sm:mt-20">
        <p className="label-caps text-ink-muted">Last step · Choose a plan</p>
        <h1 className="mt-3 text-page-title">
          Welcome to Subbies, {company.name}
        </h1>
        <p className="mt-4 text-base text-ink-muted">
          {noTrial
            ? "Pick the plan that fits your operation. This account isn't eligible for a free trial, so you'll be charged as soon as you subscribe."
            : `Pick the plan that fits your operation. Every plan starts with ${TRIAL_DAYS} days free. You'll enter a card, nothing is charged today, and you can cancel any time before day ${TRIAL_DAYS}.`}
        </p>
      </div>

      {cancelled && (
        <Alert tone="info" className="mt-6">
          Checkout cancelled. No plan was started and nothing was charged. Pick
          a plan below whenever you&apos;re ready.
        </Alert>
      )}

      <div className="mt-10">
        <PlanSelection
          plans={plans}
          heading="Choose your plan"
          intro={
            noTrial
              ? "Billed monthly in AUD, charged immediately — no free trial on this account. Change or cancel any time."
              : `Billed monthly in AUD after your ${TRIAL_DAYS}-day free trial. Change or cancel any time. Have a code? Enter it at checkout.`
          }
        />
      </div>
    </div>
    </AuthShell>
  );
}
