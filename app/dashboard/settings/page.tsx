import type { Metadata } from "next";

import { getCompany, getUser } from "@/lib/supabase/dal";
import { getEntitlement, getUsageCounts } from "@/lib/billing/entitlements";
import { reconcileCompanyFromStripe } from "@/lib/billing/sync";
import { PLANS, PLAN_IDS } from "@/lib/billing/plans";
import { SettingsTabs } from "./_components/settings-tabs";
import { isTabId, type TabId } from "./tabs";

export const metadata: Metadata = { title: "Settings" };

/**
 * Everything this page needs — company, user, entitlement, and usage — is
 * fetched exactly once here, regardless of which tab is initially requested.
 * Previously entitlement/usage were only fetched when `tab === "billing"`,
 * which sounds efficient but wasn't: since tabs were separate URLs, EVERY
 * tab click was a full navigation back through this component, so a company
 * that clicked Company → Billing → Company → Billing across one visit paid
 * for that Stripe-shaped query chain (a subscription read plus three usage
 * counts) on every single Billing click, not once. Tab switching itself no
 * longer navigates at all — see settings-tabs.tsx — so this component now
 * only runs once per real page load, and fetching everything up front is
 * both simpler and, for anyone who looks at more than one tab, cheaper than
 * before. The one honest tradeoff: a visit that only ever looks at Company
 * or Account now pays for the billing queries too, where previously it paid
 * nothing for them. Given Settings tabs exist specifically so people click
 * between them, that trade is the right one.
 */
export default async function SettingsPage(
  props: PageProps<"/dashboard/settings">,
) {
  const sp = await props.searchParams;
  const requested = typeof sp.tab === "string" ? sp.tab : "company";
  const tab: TabId = isTabId(requested) ? requested : "company";

  const checkoutParam =
    sp.checkout === "success" || sp.checkout === "cancelled"
      ? sp.checkout
      : null;

  // Company and user don't depend on each other, so they go out together
  // instead of one after the other.
  const [company, user] = await Promise.all([getCompany(), getUser()]);
  if (!company) return null;

  // On return from a successful checkout, pull the truth from Stripe directly
  // so billing reflects the new plan even if the webhook hasn't landed yet.
  // Still gated on the real ?tab=billing&checkout=success redirect Stripe
  // sends back — a one-time event, not something routine tab-switching
  // triggers — and still has to happen before the entitlement read below, so
  // that read sees the reconciled row rather than a pre-reconcile one.
  if (tab === "billing" && checkoutParam === "success") {
    await reconcileCompanyFromStripe(company.id).catch((e) =>
      console.error("checkout reconcile failed", e),
    );
  }

  const [entitlement, usage] = await Promise.all([
    getEntitlement(company.id),
    getUsageCounts(company.id),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage your company details, account, and billing.
        </p>
      </header>

      <SettingsTabs
        initialTab={tab}
        company={company}
        userEmail={user?.email}
        entitlement={{
          status: entitlement.status,
          planName: entitlement.planName,
          planAmount: entitlement.plan ? PLANS[entitlement.plan].amount : null,
          paidAccess: entitlement.paidAccess,
          onTrial: entitlement.onTrial,
          trialEndsAt: entitlement.trialEndsAt,
          currentPeriodEnd: entitlement.currentPeriodEnd,
          cancelAtPeriodEnd: entitlement.cancelAtPeriodEnd,
        }}
        usage={usage}
        limits={entitlement.limits}
        plans={PLAN_IDS.map((id) => ({
          id,
          name: PLANS[id].name,
          amount: PLANS[id].amount,
          blurb: PLANS[id].blurb,
          featured: PLANS[id].featured,
          features: PLANS[id].features,
        }))}
        checkout={checkoutParam}
      />
    </div>
  );
}
