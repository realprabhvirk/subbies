import { Suspense } from "react";

import { DashboardGate } from "./_components/dashboard-gate";
import { DashboardShellSkeleton } from "./_components/dashboard-shell-skeleton";

/**
 * Deliberately not async, and does no data access of its own. The previous
 * version of this file WAS the async gate (requireUser/getCompany/
 * getEntitlement), which meant every dashboard route — Dashboard,
 * Contractors, Projects, Document types, Settings — blocked on that same
 * round trip on every single navigation with nothing on screen while it ran:
 * loading.tsx exists for every one of those routes, but a same-segment
 * layout's own blocking data access sits above where loading.tsx's Suspense
 * boundary applies, so none of them could help. See dashboard-gate.tsx for
 * the full explanation and the Next.js docs reference.
 *
 * Splitting the gate into its own component and wrapping it here is exactly
 * the fix Next's own docs describe for this situation: wrap the layout's
 * runtime data access in its own Suspense boundary. DashboardShellSkeleton
 * matches the real shell's geometry so there's no layout jump when the real
 * one streams in.
 */
export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return (
    <Suspense fallback={<DashboardShellSkeleton />}>
      <DashboardGate>{children}</DashboardGate>
    </Suspense>
  );
}
