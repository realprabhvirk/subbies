import type { Metadata } from "next";
import { CircleCheck, Clock, CircleDashed, CalendarClock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import { StatusBadge } from "@/app/components/status-badge";
import type { Contractor } from "@/lib/types";

export const metadata: Metadata = { title: "Dashboard" };

const ACTION_STATUSES: Contractor["status"][] = [
  "awaiting_review",
  "attention_required",
  "expired",
];

export default async function DashboardPage() {
  const company = await getCompany();
  if (!company) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contractors")
    .select("id, business_name, trade, status, created_at")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  const contractors = (data ?? []) as Pick<
    Contractor,
    "id" | "business_name" | "trade" | "status" | "created_at"
  >[];

  const count = (status: Contractor["status"]) =>
    contractors.filter((c) => c.status === status).length;

  const stats = [
    {
      label: "Approved",
      value: count("approved"),
      icon: CircleCheck,
      tone: "text-approved",
    },
    {
      label: "Awaiting review",
      value: count("awaiting_review"),
      icon: Clock,
      tone: "text-review",
    },
    {
      label: "Pending onboarding",
      value: count("pending"),
      icon: CircleDashed,
      tone: "text-neutral-status",
    },
    {
      label: "Expiring soon",
      value: 0,
      icon: CalendarClock,
      tone: "text-ink-subtle",
      note: "Available once expiry tracking is on",
    },
  ];

  const actionRequired = contractors.filter((c) =>
    ACTION_STATUSES.includes(c.status),
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          An overview of {company.name}&apos;s contractors and what needs
          attention.
        </p>
      </header>

      {error && (
        <p className="rounded-md bg-expired-bg px-4 py-3 text-sm text-expired">
          We couldn&apos;t load your contractors just now. Refresh to try again.
        </p>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-card border border-line bg-surface p-5"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                <Icon className={`h-4 w-4 ${stat.tone}`} strokeWidth={2} aria-hidden />
                {stat.label}
              </div>
              <p className="mt-3 text-3xl font-semibold text-brand-ink tabular-nums">
                {stat.value}
              </p>
              {stat.note && (
                <p className="mt-1 text-xs text-ink-subtle">{stat.note}</p>
              )}
            </div>
          );
        })}
      </section>

      <section className="rounded-card border border-line bg-surface">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">Action required</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Contractors with documents to review or issues to resolve.
          </p>
        </div>

        {contractors.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">
            No contractors yet. Once you add contractors and request documents,
            their status will show here.
          </p>
        ) : actionRequired.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">
            Nothing needs attention right now.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {actionRequired.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.business_name}</p>
                  {c.trade && (
                    <p className="truncate text-sm text-ink-muted">{c.trade}</p>
                  )}
                </div>
                <StatusBadge kind="contractor" status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
