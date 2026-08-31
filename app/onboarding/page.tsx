import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireUser, getCompany } from "@/lib/supabase/dal";
import { getEntitlement } from "@/lib/billing/entitlements";
import { PLANS, PLAN_IDS } from "@/lib/billing/plans";
import { Logo } from "@/app/components/logo";
import { SignOutButton } from "@/app/dashboard/_components/sign-out-button";
import { PlanSelection } from "./_components/plan-selection";

export const metadata: Metadata = { title: "Get started" };

export default async function OnboardingPage() {
  await requireUser();
  const company = await getCompany();

  if (!company) redirect("/dashboard"); // layout shows the recovery state

  const entitlement = await getEntitlement(company.id);
  if (!entitlement.needsOnboarding) redirect("/dashboard");

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

      <div className="mt-10 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Welcome to Subbies, {company.name}
        </h1>
        <p className="mt-3 text-lg text-ink-muted">
          One quick choice and you&apos;re in. Start free for a week, or pick a
          plan now — you can switch either way later.
        </p>
      </div>

      <div className="mt-10">
        <PlanSelection plans={plans} allowFree />
      </div>
    </main>
  );
}
