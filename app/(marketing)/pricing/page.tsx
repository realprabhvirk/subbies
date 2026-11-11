import type { Metadata } from "next";
import { Check, X } from "lucide-react";

import { Band, Section, CtaBand, FaqList, SectionHead, H1 } from "../_components/ui";
import { InView } from "../_components/motion";
import { ButtonLink } from "@/app/components/button";
import {
  FEATURE_LABEL,
  FEATURE_MIN_PLAN,
  PLANS,
  PLAN_IDS,
  TRIAL_DAYS,
  can,
  isShipped,
  type PlanFeature,
} from "@/lib/billing/plans";

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
];

/** Announced features, marked "Coming soon" wherever a plan will include them. */
const COMING_SOON = (Object.keys(FEATURE_MIN_PLAN) as PlanFeature[]).filter((f) => !isShipped(f));

const INCLUDED: {
  label: string;
  included?: (p: (typeof TIERS)[number]) => boolean;
}[] = [
  { label: "Contractor onboarding & secure upload links" },
  { label: "Document review, approval & rejection" },
  { label: "Compliance status tracking" },
  { label: "Expiry reminders" },
  { label: "Project assignment and compliance", included: (p) => !isNotIncluded(p.limits.projects) },
  { label: "Project map and location", included: (p) => !isNotIncluded(p.limits.projects) },
  { label: "Jobsite photos (3 per project)", included: (p) => !isNotIncluded(p.limits.projects) },
  { label: "Email notifications" },
];

// Answers restate what the site already commits to elsewhere (trial terms,
// plan changes, cancellation, AUD pricing, contractor access). No new claims.
const FAQ = [
  {
    q: "How does the free trial work?",
    a: `Every plan starts with ${TRIAL_DAYS} days free. You enter a card at signup but nothing is charged until day ${TRIAL_DAYS}. Cancel before then and you pay nothing.`,
  },
  {
    q: "Do you charge per contractor?",
    a: "No. Each plan is one monthly price. The table above shows how many contractors, document types and projects each plan includes.",
  },
  {
    q: "Can I change plan later?",
    a: "Yes. You can change plan any time, and everything you set up carries over.",
  },
  {
    q: "What happens if I cancel?",
    a: "You can cancel any time from your billing settings. Nothing is ever deleted.",
  },
  {
    q: "Do my contractors need to pay or sign up?",
    a: "No. Contractors upload through a secure emailed link. There's nothing for them to sign up for, download or pay.",
  },
  {
    q: "What currency are prices in?",
    a: "All prices are in Australian dollars, per month.",
  },
];

const CELL = "h-12 px-5 py-2.5 align-middle";

function Yes() {
  return (
    <span className="inline-flex items-center gap-2 font-medium">
      <Check className="h-4 w-4 text-brand" strokeWidth={2.5} aria-hidden />
      Yes
    </span>
  );
}

function No() {
  return (
    <span className="inline-flex items-center gap-2 text-ink-muted">
      <X className="h-4 w-4 text-ink-subtle" strokeWidth={2.5} aria-hidden />
      No
    </span>
  );
}

function GroupRow({ label }: { label: string }) {
  return (
    <tr className="bg-surface-muted/60">
      <th scope="colgroup" colSpan={TIERS.length + 1} className="label-caps h-12 px-5 text-left text-ink-muted">
        {label}
      </th>
    </tr>
  );
}

export default function PricingPage() {
  return (
    <>
      <Section className="py-14 sm:py-20">
        <h1 className={`rise max-w-[18ch] text-balance ${H1}`}>One monthly price. No per-contractor fees.</h1>
        <p className="rise mt-5 text-lg text-ink-muted [--anim-delay:120ms]">
          {TRIAL_DAYS} days free on every plan.
        </p>
      </Section>

      <Section className="pb-16 lg:pb-20">
        {/* Three equal-height cards; the button sits on each card's floor so
            all three line up whatever the feature count. */}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-3 lg:gap-8">
          {TIERS.map((tier, i) => (
            <InView key={tier.id} delay={i * 100} className="flex">
            <div
              className={`relative flex flex-1 flex-col overflow-hidden rounded-card border bg-surface p-6 sm:p-8 ${
                tier.featured ? "border-brand shadow-lg ring-1 ring-brand" : "border-line"
              }`}
            >
              {tier.tag ? (
                <p className="label-caps mb-3 text-brand">{tier.tag}</p>
              ) : (
                <p aria-hidden className="label-caps invisible mb-3 hidden lg:block">&nbsp;</p>
              )}
              <h2 className="text-xl sm:text-2xl">{tier.name}</h2>
              <p className="mt-2 min-h-12 text-base text-ink-muted">{tier.blurb}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="figure text-5xl leading-none">A${tier.amount}</span>
                <span className="text-base text-ink-muted">/ month</span>
              </p>
              <ul className="mt-7 divide-y divide-line border-y border-line text-[15px]">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 py-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
                {tier.comingSoon.map((f) => (
                  <li key={f} className="flex items-start justify-between gap-3 py-2.5 text-ink-muted">
                    <span>{f}</span>
                    <ComingSoon />
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <ButtonLink
                  href="/signup"
                  variant={tier.featured ? "primary" : "outline"}
                  size="lg"
                  className="w-full"
                >
                  Start your {TRIAL_DAYS}-day free trial
                </ButtonLink>
              </div>
            </div>
            </InView>
          ))}
        </div>
      </Section>

      {/* Comparison. On a phone the table scrolls sideways inside its own
          box; from lg the box stops clipping so the header can stick under
          the nav while the rows scroll past. */}
      <Band tone="surface" bordered innerClassName="py-section">
        <SectionHead label="Compare plans" title="Side by side." />
        <div className="relative mt-10 w-full min-w-0 max-w-full overflow-x-auto rounded-card border border-line bg-surface lg:overflow-visible">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[15px]">
            <thead>
              <tr>
                <th
                  scope="col"
                  className={`${CELL} label-caps border-b border-line-strong bg-surface-muted text-left text-ink-muted lg:sticky lg:top-[72px] lg:z-10 lg:rounded-tl-card`}
                >
                  Plan
                </th>
                {TIERS.map((t, i) => (
                  <th
                    key={t.id}
                    scope="col"
                    className={`${CELL} border-b border-line-strong bg-surface-muted text-left font-display text-base font-semibold lg:sticky lg:top-[72px] lg:z-10 ${
                      t.featured ? "text-brand" : ""
                    } ${i === TIERS.length - 1 ? "lg:rounded-tr-card" : ""}`}
                  >
                    {t.name}
                    <span className="ml-2 font-sans text-sm font-normal text-ink-muted">A${t.amount}/mo</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-line [&_th]:border-b [&_th]:border-line [&_tr:last-child>*]:border-b-0">
              <GroupRow label="Limits" />
              {COMPARISON.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className={`${CELL} text-left font-medium text-ink-muted`}>
                    {row.label}
                  </th>
                  {TIERS.map((t) => (
                    <td
                      key={t.id}
                      className={`${CELL} ${/^\d+$/.test(row.value(t)) ? "font-mono text-base" : "font-medium"} ${t.featured ? "bg-brand-tint/30" : ""}`}
                    >
                      {row.notIncluded?.(t) ? <No /> : row.value(t)}
                    </td>
                  ))}
                </tr>
              ))}
              <GroupRow label="Included" />
              {INCLUDED.map((feature) => (
                <tr key={feature.label}>
                  <th scope="row" className={`${CELL} text-left font-medium text-ink-muted`}>
                    {feature.label}
                  </th>
                  {TIERS.map((t) => {
                    const included = feature.included ? feature.included(t) : true;
                    return (
                      <td key={t.id} className={`${CELL} ${t.featured ? "bg-brand-tint/30" : ""}`}>
                        {included ? <Yes /> : <No />}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {COMING_SOON.length > 0 && <GroupRow label="Coming soon" />}
              {COMING_SOON.map((feature) => (
                <tr key={feature}>
                  <th scope="row" className={`${CELL} text-left font-medium text-ink-muted`}>
                    {FEATURE_LABEL[feature]}
                  </th>
                  {TIERS.map((t) => (
                    <td key={t.id} className={`${CELL} ${t.featured ? "bg-brand-tint/30" : ""}`}>
                      {can(t.id, feature) ? <ComingSoon /> : <No />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Band>

      <Band tone="canvas" innerClassName="grid gap-10 py-section lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <SectionHead label="Questions" title="Pricing questions." />
        <FaqList items={FAQ} />
      </Band>

      <CtaBand
        heading="Not sure which plan fits?"
        sub="Change plan any time. Everything you set up carries over."
      />
    </>
  );
}

function ComingSoon() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-line bg-surface-muted px-2.5 py-0.5 text-sm font-semibold text-ink-muted">
      Coming soon
    </span>
  );
}
