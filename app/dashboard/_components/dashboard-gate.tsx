import { Suspense } from "react";
import { redirect } from "next/navigation";

import { requireUser, getCompany } from "@/lib/supabase/dal";
import { getEntitlement } from "@/lib/billing/entitlements";
import { Logo } from "@/app/components/logo";
import { SignOutButton } from "./sign-out-button";
import { DashboardShell } from "./dashboard-shell";
import { NotificationsSlot, NotificationsBellFallback } from "./notifications-slot";
import { SoftLock } from "./soft-lock";

/**
 * The actual auth/company/entitlement gate — moved out of layout.tsx and
 * into its own async component specifically so layout.tsx can wrap it in a
 * <Suspense> boundary. Per Next's own docs (file-conventions/loading.md,
 * "Good to know"): a layout that reads uncached/runtime data — this one
 * calls requireUser() and getCompany(), both backed by cookies — blocks
 * navigation entirely and loading.tsx cannot show a fallback for it, because
 * loading.tsx's implicit Suspense boundary wraps page.js and nested
 * layout.js, but never the same-segment layout.js doing the blocking work.
 * That's the actual cause of "sidebar highlights, content doesn't, for
 * seconds" — every dashboard route shares this layout, so every single
 * sidebar click paid for this same unavoidable round trip with zero visual
 * feedback while it ran.
 *
 * This doesn't remove that round trip — it's a real access check (company
 * existence, onboarding completion, entitlement/soft-lock) that has to be
 * re-evaluated on every navigation for correctness: a subscription that
 * lapses mid-session must lock the very next click, not whenever some
 * client-side cache happens to expire. That rules out the tab-switch fix's
 * "fetch once, keep in state" approach here — the fix is purely about
 * making the wait visible, not skipping it.
 */
export async function DashboardGate({ children }: { children: React.ReactNode }) {
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
