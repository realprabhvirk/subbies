import { redirect } from "next/navigation";

import { requireUser, getCompany } from "@/lib/supabase/dal";
import { reconcileCompanyFromStripe } from "@/lib/billing/sync";
import { getEntitlement } from "@/lib/billing/entitlements";

export const metadata = { title: "Finishing up…" };

/**
 * Stripe Checkout returns here. We pull the subscription state straight from
 * Stripe (so it's correct before the dashboard layout runs its onboarding /
 * access checks), then send the user on.
 */
export default async function BillingReturnPage(
  props: PageProps<"/billing/return">,
) {
  await requireUser();
  const company = await getCompany();
  if (!company) redirect("/dashboard");

  const sp = await props.searchParams;
  const cancelled = sp.state === "cancelled";

  if (!cancelled) {
    await reconcileCompanyFromStripe(company.id).catch((e) =>
      console.error("billing return reconcile failed", e),
    );
  }

  const entitlement = await getEntitlement(company.id);

  if (entitlement.paidAccess) {
    redirect("/dashboard/settings?tab=billing&checkout=success");
  }

  // Checkout was abandoned before onboarding completed. The settings page would
  // immediately bounce them to /onboarding by the dashboard layout's gate and
  // swallow the message, so send them straight there instead.
  if (entitlement.needsOnboarding) {
    redirect("/onboarding?checkout=cancelled");
  }

  redirect("/dashboard/settings?tab=billing&checkout=cancelled");
}
