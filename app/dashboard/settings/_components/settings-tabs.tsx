"use client";

import { useEffect, useState } from "react";
import { FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

import { Card } from "@/app/components/card";
import { CompanyProfileForm } from "./company-profile-form";
import { ChangePasswordForm } from "./change-password-form";
import { DeleteAccountSection } from "./delete-account-section";
import { BillingPanel, type BillingEntitlementView } from "./billing-panel";
import type { LimitedResource } from "@/lib/billing/plans";
import type { BillingPlan } from "@/app/components/plan-cards";
import type { Company } from "@/lib/types";
import { TABS, isTabId, type TabId } from "../tabs";

/**
 * Every tab used to be its own URL (`?tab=x`), which made a tab click a real
 * Next.js navigation: a fresh request, a fresh render of this whole Server
 * Component, and — critically — a fresh set of Supabase queries (company,
 * and for Billing, the subscription plus three usage counts), every single
 * time, even switching back to a tab already open a second ago. Buttons on
 * this same page felt instant by comparison because they're client-side
 * state changes or small Server Actions, not full-page navigations.
 *
 * The actual data (company, user, entitlement, usage) is now fetched exactly
 * once, up front, by the Server Component in page.tsx, and handed down as
 * props. This component owns which tab is showing as plain client state —
 * switching tabs is a re-render, not a request. All three tab bodies mount
 * once and stay mounted (toggled with the native `hidden` attribute rather
 * than conditional JSX), so an in-progress edit in one tab survives a trip
 * to another and back, and nothing needs to refetch to "come back fresh" —
 * it was never thrown away.
 *
 * The URL still updates (via the History API directly, not next/router) so
 * the tab is still bookmarkable/shareable/back-button-able — but that's a
 * plain client-side history entry, not a navigation, so it triggers no
 * request of any kind.
 */
export function SettingsTabs({
  initialTab,
  company,
  userEmail,
  entitlement,
  usage,
  limits,
  plans,
  checkout,
}: {
  initialTab: TabId;
  company: Company;
  userEmail: string | null | undefined;
  entitlement: BillingEntitlementView;
  usage: Record<LimitedResource, number>;
  limits: Record<LimitedResource, number | null>;
  plans: BillingPlan[];
  checkout: "success" | "cancelled" | null;
}) {
  const [tab, setTab] = useState<TabId>(initialTab);

  // Back/forward between tabs still works, since each click below pushes a
  // real history entry — this just keeps the visible tab in sync with it.
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("tab") ?? "company";
      setTab(isTabId(requested) ? requested : "company");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const switchTab = (id: TabId) => {
    if (id !== tab) {
      window.history.pushState(null, "", `/dashboard/settings?tab=${id}`);
    }
    setTab(id);
  };

  return (
    <>
      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-brand text-brand-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-8 space-y-6" hidden={tab !== "company"}>
        <CompanyProfileForm company={company} />

        <Card className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <FileText
              className="mt-0.5 h-5 w-5 text-ink-subtle"
              strokeWidth={2}
              aria-hidden
            />
            <div>
              <p className="text-sm font-medium">Document types</p>
              <p className="text-sm text-ink-muted">
                The compliance documents you collect from contractors.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/document-types"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            Manage
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Link>
        </Card>
      </div>

      <div className="mt-8 space-y-6" hidden={tab !== "account"}>
        <Card>
          <h3 className="text-sm font-semibold">Account email</h3>
          <p className="mt-1 text-sm text-ink-muted">{userEmail}</p>
        </Card>
        <ChangePasswordForm />
        <DeleteAccountSection />
      </div>

      <div className="mt-8" hidden={tab !== "billing"}>
        <BillingPanel
          entitlement={entitlement}
          usage={usage}
          limits={limits}
          plans={plans}
          checkout={checkout}
        />
      </div>
    </>
  );
}
