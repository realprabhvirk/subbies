import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireUser, getCompany } from "@/lib/supabase/dal";
import { getEntitlement } from "@/lib/billing/entitlements";
import type { AppNotification } from "@/lib/types";
import { Logo } from "@/app/components/logo";
import { SignOutButton } from "./_components/sign-out-button";
import { DashboardShell } from "./_components/dashboard-shell";
import { SoftLock } from "./_components/soft-lock";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  await requireUser();
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

  // Trial ended without converting, or a plan lapsed — block the dashboard.
  if (entitlement.softLocked) {
    return <SoftLock trialEnded={entitlement.plan !== null} />;
  }

  const supabase = await createClient();
  const [{ data: notifData }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, company_id, contractor_id, type, message, read_at, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company.id)
      .is("read_at", null),
  ]);

  const notifications = (notifData ?? []) as AppNotification[];
  const unreadCount = count ?? 0;

  return (
    <DashboardShell
      companyName={company.name}
      notifications={notifications}
      unreadCount={unreadCount}
      trialEndsAt={entitlement.onTrial ? entitlement.trialEndsAt : null}
    >
      {children}
    </DashboardShell>
  );
}
