import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { Section, Eyebrow, CtaBand } from "../_components/ui";
import { PLANS, PLAN_IDS, TRIAL_DAYS } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    `Simple monthly pricing for contractor compliance tracking. Every plan starts with a ${TRIAL_DAYS}-day free trial.`,
};

const TIERS = PLAN_IDS.map((id) => PLANS[id]);

function limitText(v: number | null): string {
  return v === null ? "Unlimited" : String(v);
}

const COMPARISON: {
  label: string;
  value: (p: (typeof TIERS)[number]) => string;
}[] = [
  { label: "Contractors", value: (p) => limitText(p.limits.contractors) },
  { label: "Document types", value: (p) => limitText(p.limits.documentTypes) },
  { label: "Projects", value: (p) => limitText(p.limits.projects) },
  {
    label: "Document storage",
    value: (p) =>
      p.storageMarketing === null ? "Unlimited" : `${p.storageMarketing}`,
  },
];

const INCLUDED = [
  "Contractor onboarding & secure upload links",
  "Document review, approval & rejection",
  "Compliance status tracking",
  "Expiry reminders",
  "Project assignment",
  "Email notifications",
];

export default function PricingPage() {
  return (
    <>
      <Section className="pt-16 pb-6 text-center sm:pt-20">
        <Eyebrow>Pricing</Eyebrow>
        <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          One monthly price. No per-contractor fees.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-muted">
          Pick a plan by the size of your operation. Every plan starts with a{" "}
          {TRIAL_DAYS}-day free trial. Nothing is charged until day{" "}
          {TRIAL_DAYS}.
        </p>
      </Section>

      <Section className="py-10">
        <div className="grid items-start gap-5 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`flex flex-col rounded-card border bg-surface p-6 ${
                tier.featured
                  ? "border-brand shadow-md ring-1 ring-brand/20 lg:-my-3 lg:py-9"
                  : "border-line"
              }`}
            >
              {tier.featured && (
                <span className="mb-3 inline-flex w-fit rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}
              <h2 className="text-lg font-semibold">{tier.name}</h2>
              <p className="mt-1 text-sm text-ink-muted">{tier.blurb}</p>
              <p className="mt-4">
                <span className="text-4xl font-semibold text-brand-ink">
                  A${tier.amount}
                </span>
                <span className="text-sm text-ink-muted"> / month</span>
              </p>
              <Link
                href="/signup"
                className={`mt-5 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors ${
                  tier.featured
                    ? "bg-brand text-white hover:bg-brand-hover"
                    : "border border-line-strong text-ink hover:bg-surface-muted"
                }`}
              >
                Start free
              </Link>
              <ul className="mt-6 space-y-2.5 text-sm">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-approved"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    <span className="text-ink-muted">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-ink-subtle">
          {TRIAL_DAYS} days free on any plan. You enter a card at signup but
          nothing is charged until day {TRIAL_DAYS}. Cancel before then and you
          pay nothing. Nothing is ever deleted.
        </p>
      </Section>

      {/* Comparison */}
      <Section className="py-10">
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-5 py-3 text-left font-semibold">Plan</th>
                {TIERS.map((t) => (
                  <th
                    key={t.id}
                    className={`px-5 py-3 text-left font-semibold ${
                      t.featured ? "text-brand-ink" : ""
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
                  <td className="px-5 py-3 text-ink-muted">{row.label}</td>
                  {TIERS.map((t) => (
                    <td key={t.id} className="px-5 py-3 tabular-nums">
                      {row.value(t)}
                    </td>
                  ))}
                </tr>
              ))}
              {INCLUDED.map((feature) => (
                <tr key={feature}>
                  <td className="px-5 py-3 text-ink-muted">{feature}</td>
                  {TIERS.map((t) => (
                    <td key={t.id} className="px-5 py-3">
                      <Check
                        className="h-4 w-4 text-approved"
                        strokeWidth={2.5}
                        aria-hidden
                      />
                      <span className="sr-only">Included</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-subtle">
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
