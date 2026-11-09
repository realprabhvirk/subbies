import type { Metadata } from "next";
import { Check, Minus, X } from "lucide-react";

import { Section, Eyebrow, CtaBand } from "../_components/ui";
import { ButtonLink } from "@/app/components/button";
import { PLANS, PLAN_IDS, TRIAL_DAYS } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    `Simple monthly pricing for contractor compliance tracking. Every plan starts with a ${TRIAL_DAYS}-day free trial.`,
};

const TIERS = PLAN_IDS.map((id) => PLANS[id]);

/** A limit of 0 means the plan doesn't include the feature at all. */
function isNotIncluded(v: number | null): boolean {
  return v === 0;
}

function limitText(v: number | null): string {
  return v === null ? "Unlimited" : String(v);
}

const COMPARISON: {
  label: string;
  value: (p: (typeof TIERS)[number]) => string;
  /** Renders a cross instead of the value when the plan doesn't include it. */
  notIncluded?: (p: (typeof TIERS)[number]) => boolean;
}[] = [
  { label: "Contractors", value: (p) => limitText(p.limits.contractors) },
  { label: "Document types", value: (p) => limitText(p.limits.documentTypes) },
  {
    label: "Projects",
    value: (p) => limitText(p.limits.projects),
    notIncluded: (p) => isNotIncluded(p.limits.projects),
  },
  {
    label: "Document storage",
    value: (p) =>
      p.storageMarketing === null ? "Unlimited" : `${p.storageMarketing}`,
  },
];

const INCLUDED: {
  label: string;
  included?: (p: (typeof TIERS)[number]) => boolean;
}[] = [
  { label: "Contractor onboarding & secure upload links" },
  { label: "Document review, approval & rejection" },
  { label: "Compliance status tracking" },
  { label: "Expiry reminders" },
  { label: "Project assignment", included: (p) => !isNotIncluded(p.limits.projects) },
  { label: "Email notifications" },
];

export default function PricingPage() {
  return (
    <>
      <Section className="pb-12 pt-14 sm:pt-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end">
          <div>
            <Eyebrow>Pricing</Eyebrow>
            <h1 className="mt-5 text-4xl leading-[1] tracking-display sm:text-6xl">
              One monthly price. No per-contractor fees.
            </h1>
          </div>
          <p className="text-base text-ink-muted sm:text-lg">
            Pick a plan by the size of your operation. Every plan starts with a{" "}
            {TRIAL_DAYS}-day free trial. Nothing is charged until day{" "}
            {TRIAL_DAYS}.
          </p>
        </div>
      </Section>

      <Section className="pb-10">
        {/* One rate card, three columns divided by rules. */}
        <div className="grid overflow-hidden rounded-card border border-line bg-surface lg:grid-cols-3">
          {TIERS.map((tier, i) => (
            <div
              key={tier.id}
              className={`relative flex flex-col p-6 sm:p-8 ${
                i > 0 ? "border-t border-line lg:border-l lg:border-t-0" : ""
              } ${tier.featured ? "bg-brand-tint/40" : ""}`}
            >
              {tier.featured && (
                <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-brand" />
              )}
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xl">{tier.name}</h2>
                {tier.featured && (
                  <span className="label-caps text-brand">Most popular</span>
                )}
              </div>
              <p className="mt-2 min-h-12 text-sm text-ink-muted">{tier.blurb}</p>
              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="figure text-6xl">A${tier.amount}</span>
                <span className="text-sm text-ink-muted">/ month</span>
              </p>
              <ButtonLink
                href="/signup"
                variant={tier.featured ? "primary" : "secondary"}
                className="mt-7 w-full"
              >
                Start free
              </ButtonLink>
              <ul className="mt-7 divide-y divide-line border-t border-line text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 py-2.5">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-approved"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-5 max-w-3xl text-sm text-ink-muted">
          {TRIAL_DAYS} days free on any plan. You enter a card at signup but
          nothing is charged until day {TRIAL_DAYS}. Cancel before then and you
          pay nothing. Nothing is ever deleted.
        </p>
      </Section>

      {/* Comparison */}
      <Section className="pb-section pt-10">
        <h2 className="text-2xl sm:text-3xl">Compare plans</h2>
        <div className="relative mt-6 overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line-strong bg-surface-muted">
                <th scope="col" className="label-caps px-5 py-3 text-left text-ink-muted">
                  Plan
                </th>
                {TIERS.map((t) => (
                  <th
                    key={t.id}
                    scope="col"
                    className={`px-5 py-3 text-left font-display text-base font-semibold ${
                      t.featured ? "text-brand" : ""
                    }`}
                  >
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COMPARISON.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-5 py-3.5 text-left font-medium text-ink-muted">
                    {row.label}
                  </th>
                  {TIERS.map((t) => (
                    <td
                      key={t.id}
                      className={`px-5 py-3.5 ${/^\d+$/.test(row.value(t)) ? "font-mono text-xs" : "font-medium"} ${t.featured ? "bg-brand-tint/30" : ""}`}
                    >
                      {row.notIncluded?.(t) ? (
                        <>
                          <X
                            className="h-4 w-4 text-ink-subtle"
                            strokeWidth={2.5}
                            aria-hidden
                          />
                          <span className="sr-only">Not included</span>
                        </>
                      ) : (
                        row.value(t)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {INCLUDED.map((feature) => (
                <tr key={feature.label}>
                  <th scope="row" className="px-5 py-3.5 text-left font-medium text-ink-muted">
                    {feature.label}
                  </th>
                  {TIERS.map((t) => {
                    const included = feature.included ? feature.included(t) : true;
                    return (
                      <td key={t.id} className={`px-5 py-3.5 ${t.featured ? "bg-brand-tint/30" : ""}`}>
                        {included ? (
                          <>
                            <Check
                              className="h-4 w-4 text-approved"
                              strokeWidth={2.5}
                              aria-hidden
                            />
                            <span className="sr-only">Included</span>
                          </>
                        ) : (
                          <>
                            <X
                              className="h-4 w-4 text-ink-subtle"
                              strokeWidth={2.5}
                              aria-hidden
                            />
                            <span className="sr-only">Not included</span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
          <Minus className="h-3 w-3" strokeWidth={2} aria-hidden />
          Document storage figures are a guide. We&apos;ll be in touch well before
          any account approaches a real limit.
        </p>
      </Section>

      <CtaBand
        heading="Not sure which plan fits?"
        sub="Start free. You can change plan any time, and everything you set up carries over."
      />
    </>
  );
}
