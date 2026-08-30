import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";

import { getCompany, getUser } from "@/lib/supabase/dal";
import { CompanyProfileForm } from "./_components/company-profile-form";
import { ChangePasswordForm } from "./_components/change-password-form";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { id: "company", label: "Company" },
  { id: "account", label: "Account" },
  { id: "billing", label: "Billing" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default async function SettingsPage(
  props: PageProps<"/dashboard/settings">,
) {
  const company = await getCompany();
  if (!company) return null;
  const user = await getUser();

  const sp = await props.searchParams;
  const requested = typeof sp.tab === "string" ? sp.tab : "company";
  const tab: TabId = TABS.some((t) => t.id === requested)
    ? (requested as TabId)
    : "company";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage your company details, account, and billing.
        </p>
      </header>

      <div className="flex gap-1 border-b border-line">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={`/dashboard/settings?tab=${t.id}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-brand text-brand-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {tab === "company" && (
        <div className="space-y-6">
          <CompanyProfileForm company={company} />

          <div className="flex items-center justify-between rounded-card border border-line bg-surface p-5">
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
          </div>
        </div>
      )}

      {tab === "account" && (
        <div className="space-y-6">
          <div className="rounded-card border border-line bg-surface p-6">
            <h3 className="text-sm font-semibold">Account email</h3>
            <p className="mt-1 text-sm text-ink-muted">{user?.email}</p>
          </div>
          <ChangePasswordForm />
        </div>
      )}

      {tab === "billing" && (
        <div className="rounded-card border border-line bg-surface p-6">
          <h3 className="text-sm font-semibold">Billing</h3>
          <p className="mt-1 max-w-prose text-sm text-ink-muted">
            You&apos;re on the free early-access plan. Paid plans and billing
            management will appear here once checkout is switched on.
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            See the plans
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      )}
    </div>
  );
}
