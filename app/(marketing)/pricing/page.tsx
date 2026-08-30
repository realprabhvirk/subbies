import type { Metadata } from "next";
import Link from "next/link";
import { Check, Info } from "lucide-react";

import { Section, Eyebrow, CtaBand } from "../_components/ui";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple monthly pricing for contractor compliance tracking. Indicative figures — final pricing to be confirmed.",
};

interface Tier {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  featured?: boolean;
  features: string[];
}

// NOTE: placeholder pricing and feature splits — to be finalised by the founder.
const TIERS: Tier[] = [
  {
    name: "Starter",
    price: "$29",
    cadence: "/month",
    blurb: "For smaller operators bringing on a handful of contractors.",
    features: [
      "Up to 20 contractors",
      "Unlimited document types",
      "Secure upload links",
      "Review, approve & reject",
      "Expiry reminders",
      "Email support",
    ],
  },
  {
    name: "Business",
    price: "$49",
    cadence: "/month",
    blurb: "For established builders running multiple jobs at once.",
    featured: true,
    features: [
      "Up to 75 contractors",
      "Everything in Starter",
      "Projects & job assignment",
      "Compliance status per project",
      "Reminder escalation",
      "Priority email support",
    ],
  },
  {
    name: "Pro",
    price: "$99",
    cadence: "/month",
    blurb: "For larger teams and higher contractor turnover.",
    features: [
      "Unlimited contractors",
      "Everything in Business",
      "Full activity history",
      "Early access to new features",
    ],
  },
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
          Pick a plan by how many contractors you manage. Change or cancel any
          time.
        </p>
      </Section>

      <Section className="pb-4">
        <div className="mx-auto flex max-w-2xl items-start gap-2.5 rounded-md border border-attention-line bg-attention-bg px-4 py-3 text-sm text-attention">
          <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>
            <strong>Indicative pricing.</strong> These figures and the feature
            breakdown are placeholders and not final. Contact us for current
            founding-customer pricing.
          </span>
        </div>
      </Section>

      <Section className="py-10">
        <div className="grid gap-5 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col rounded-card border bg-surface p-6 ${
                tier.featured
                  ? "border-brand shadow-sm ring-1 ring-brand/20"
                  : "border-line"
              }`}
            >
              {tier.featured && (
                <span className="mb-3 inline-flex w-fit rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-semibold text-brand-ink">
                  Most popular
                </span>
              )}
              <h2 className="text-lg font-semibold">{tier.name}</h2>
              <p className="mt-1 text-sm text-ink-muted">{tier.blurb}</p>
              <p className="mt-4">
                <span className="text-3xl font-semibold text-brand-ink">
                  {tier.price}
                </span>
                <span className="text-sm text-ink-muted">{tier.cadence}</span>
              </p>
              <Link
                href="/signup"
                className={`mt-5 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors ${
                  tier.featured
                    ? "bg-brand text-white hover:bg-brand-hover"
                    : "border border-line-strong text-ink hover:bg-surface-muted"
                }`}
              >
                Start free trial
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
          Every plan starts with a free trial — no charge until it ends, cancel
          any time.
        </p>
      </Section>

      <CtaBand
        heading="Not sure which plan fits?"
        sub="Tell us how many contractors you manage and we'll point you to the right one."
      />
    </>
  );
}
