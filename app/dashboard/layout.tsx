import { Suspense } from "react";
import { redirect } from "next/navigation";

import { requireUser, getCompany } from "@/lib/supabase/dal";
import { getEntitlement } from "@/lib/billing/entitlements";
import { Logo } from "@/app/components/logo";
import { SignOutButton } from "./_components/sign-out-button";
import { DashboardShell } from "./_components/dashboard-shell";
import {
  NotificationsSlot,
  NotificationsBellFallback,
} from "./_components/notifications-slot";
import { SoftLock } from "./_components/soft-lock";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const user = await requireUser();
  const company = await getCompany();

  if (!company) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 shadow-sm">
          <Logo className="mb-6" />
          <h1 className="text-lg font-semibold">Account setup incomplete</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Your login exists but it isn&apos;t linked to a company yet. Sign out
            and sign up again, or contact support if this keeps happening.
          </p>
          <div className="mt-6">
            <SignOutButton variant="inline" />
          </div>
        </div>
      </main>
    );
  }

  const entitlement = await getEntitlement(company.id);

  // First-time forced plan-selection gate.
  if (entitlement.needsOnboarding) redirect("/onboarding");

  // Trial ended without payment / plan lapsed — block the dashboard entirely.
  if (entitlement.softLocked) {
    return <SoftLock />;
  }

  // Everything above this point gates access and has to resolve first. The
  // bell does not, so it streams in its own boundary and the shell paints
  // without waiting on it.
  return (
    <DashboardShell
      companyName={company.name}
      userEmail={user.email}
      notificationsSlot={
        <Suspense fallback={<NotificationsBellFallback />}>
          <NotificationsSlot />
        </Suspense>
      }
      trialEndsAt={entitlement.trialEndsAt}
      planName={entitlement.planName}
    >
      {children}
    </DashboardShell>
  );
}
