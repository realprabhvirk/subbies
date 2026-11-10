import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, FileCheck } from "lucide-react";

import {
  Section,
  SectionHead,
  Eyebrow,
  Reveal,
  PrimaryLink,
  CtaBand,
} from "./_components/ui";
import { TRIAL_DAYS, PLANS } from "@/lib/billing/plans";
import { ProductPreview } from "./_components/product-preview";
import { UploadPreview } from "./_components/upload-preview";
import { ReminderPreview } from "./_components/reminder-preview";

export const metadata: Metadata = {
  title: {
    absolute: "Subbies: contractor onboarding & compliance tracking",
  },
  description:
    "Stop chasing contractors for paperwork and know whether they're approved to work. Collect, review, and track compliance documents in one place.",
};

const FACTS = [
  { k: "Contractor logins", v: "None. One link." },
  { k: "Accepted files", v: "PDF, JPG, PNG, HEIC" },
  { k: "Expiry reminders", v: "On your schedule" },
  { k: "Plans from", v: `A$${PLANS.starter.amount} / month` },
];

const STEPS = [
  {
    title: "Onboard",
    body: "Add a contractor, tick the documents you need from them, and Subbies emails one secure link.",
  },
  {
    title: "Collect",
    body: "They upload from their phone on site — a photo of the certificate is fine. No login, no account, no app.",
  },
  {
    title: "Review",
    body: "Open each file, set its expiry date, approve it or send it back with a reason they'll actually read.",
  },
  {
    title: "Track",
    body: "Everyone's status stays current. Reminders go out before anything expires, and your dashboard shows who needs you.",
  },
];

const FEATURES = [
  {
    label: "For the contractor",
    title: "Nothing to sign up for.",
    body: "The contractor gets a plain email from your business and one link. They see exactly what's outstanding, upload from their phone, and they're done. The step where onboarding usually stalls — making an account — isn't there.",
    points: [
      "Works on any phone, no app",
      "Photos and PDFs both accepted",
      "Same link works when a document renews",
    ],
    preview: <UploadPreview />,
  },
  {
    label: "For the expiry dates",
    title: "Reminders before anything lapses.",
    body: "Set an expiry when you approve a document. Subbies reminds the contractor on the schedule you choose for that document type, and escalates to you if they don't respond.",
    points: [
      "A schedule per document type",
      "Days left shown on every record",
      "Lapses show up on your dashboard",
    ],
    preview: <ReminderPreview />,
  },
  {
    label: "For you",
    title: "One register, worst first.",
    body: "Every certificate, licence and insurance document for every contractor, reviewed and tracked in one place. The dashboard leads with what needs you — expired, rejected, waiting for review — not a wall of charts.",
    points: [
      "Status stamps you can read at a glance",
      "Compliance per project",
      "Full history of every document",
    ],
    preview: <ProductPreview />,
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero — editorial, left-set, the real product beside the promise.
          The ruled background is the "register" motif, drawn in the warm
          hairline colour. */}
      <section className="relative isolate overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, transparent 0, transparent 39px, var(--color-line) 39px, var(--color-line) 40px)",
          }}
        />
        <Section className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 pb-16 pt-14 sm:pb-24 sm:pt-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14 lg:pb-32 lg:pt-24">
          <div>
            <Eyebrow>Contractor onboarding &amp; compliance</Eyebrow>
            <h1 className="mt-5 text-[2.6rem] leading-[0.98] tracking-display sm:text-6xl xl:text-[4.25rem]">
              Stop chasing paperwork. Know who&apos;s cleared for site.
            </h1>
            <p className="mt-6 max-w-xl text-base text-ink-muted sm:text-lg">
              Collect insurance certificates, licences and workers comp from your
              subcontractors, review them in one place, and see at a glance
              who is approved to work.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              <PrimaryLink href="/signup">Start {TRIAL_DAYS}-day free trial</PrimaryLink>
              <Link
                href="/how-it-works"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink transition-colors hover:text-brand"
              >
                See how it works
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5"
                  strokeWidth={2.25}
                  aria-hidden
                />
              </Link>
            </div>
            <p className="mt-6 text-sm text-ink-muted">
              Card required, nothing charged for {TRIAL_DAYS} days. Built for
              builders, property maintenance and facilities teams.
            </p>
          </div>

          {/* Product composite: the register with the contractor's phone
              view overlapping its corner. */}
          <div aria-hidden className="relative sm:pt-16">
            <ProductPreview />
            {/* The moment the product exists for: a contractor's upload
                landing. Mirrors the app's real notification copy. */}
            <div className="absolute -left-4 top-0 hidden w-80 items-start gap-3 rounded-card border border-line bg-surface p-3.5 shadow-lg sm:flex xl:-left-10">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-review-line bg-review-bg text-review">
                <FileCheck className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug">
                  BJ Plumbing &amp; Gas uploaded Public liability insurance
                </p>
                <p className="mt-1 font-mono text-2xs text-ink-subtle">just now</p>
              </div>
            </div>
          </div>
        </Section>
      </section>

      {/* Facts strip — true statements about the product, in place of a logo
          wall or invented stats. */}
      <div className="border-b border-line bg-surface">
        <Section>
          <dl className="grid grid-cols-2 lg:grid-cols-4">
            {FACTS.map((f, i) => (
              <div
                key={f.k}
                className={`py-6 sm:py-8 ${i % 2 === 1 ? "border-l border-line pl-5 sm:pl-8" : ""} ${
                  i >= 2 ? "border-t border-line lg:border-t-0" : ""
                } ${i === 2 ? "lg:border-l lg:pl-8" : ""}`}
              >
                <dt className="label-caps text-ink-muted">{f.k}</dt>
                <dd className="mt-2 font-display text-lg font-semibold sm:text-xl">{f.v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>

      {/* The problem — named plainly, in two columns: the claim, the cost. */}
      <Section className="py-section">
        <Reveal className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <SectionHead
            index="01"
            label="The problem"
            title="You're not short on subbies. You're short on certainty about them."
          />
          <div className="space-y-4 text-base text-ink-muted lg:pt-16">
            <p>
              Insurance certificates that quietly lapse. A licence you meant to
              check before the job started. A spreadsheet three people are
              editing at once, none of them sure which version is current.
            </p>
            <p>
              It costs an afternoon every time you chase it down, and it&apos;s
              invisible right up until it isn&apos;t —{" "}
              <span className="font-semibold text-ink">
                an expired policy on site, discovered at the worst possible
                moment.
              </span>
            </p>
          </div>
        </Reveal>
      </Section>

      {/* How it works — four ruled, numbered steps. */}
      <div className="border-y border-line bg-surface">
        <Section className="py-section">
          <Reveal>
            <SectionHead
              index="02"
              label="How it works"
              title={
                <>
                  From &ldquo;we need someone Monday&rdquo; to approved, without
                  the back-and-forth.
                </>
              }
            />
          </Reveal>
          <ol className="mt-14 grid border-t border-ink sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className={`border-b border-line py-7 sm:pr-8 lg:border-b-0 ${
                  i > 0 ? "lg:border-l lg:pl-8" : ""
                } ${i % 2 === 1 ? "sm:border-l sm:pl-8 lg:pl-8" : ""}`}
              >
                <span className="figure text-4xl text-line-strong">0{i + 1}</span>
                <h3 className="mt-4 text-xl">{step.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Link
              href="/how-it-works"
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
            >
              The full walkthrough
              <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </Link>
          </div>
        </Section>
      </div>

      {/* Features — alternating text and real product, separated by rules. */}
      <Section className="py-section">
        <Reveal>
          <SectionHead
            index="03"
            label="What you get"
            title="The parts that actually take time, handled."
          />
        </Reveal>
        <div className="mt-14 divide-y divide-line border-y border-line">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title}>
              <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 py-12 sm:py-16 lg:grid-cols-2 lg:gap-16">
                <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                  <Eyebrow className="text-brand">{f.label}</Eyebrow>
                  <h3 className="mt-3 text-2xl leading-tight tracking-display sm:text-4xl">
                    {f.title}
                  </h3>
                  <p className="mt-4 max-w-lg text-base text-ink-muted">{f.body}</p>
                  <ul className="mt-6 max-w-lg divide-y divide-line border-y border-line">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-center gap-2.5 py-2.5 text-sm">
                        <Check className="h-4 w-4 shrink-0 text-approved" strokeWidth={2.5} aria-hidden />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div aria-hidden className={`mx-auto w-full max-w-md ${i % 2 === 1 ? "lg:order-1" : ""}`}>
                  {f.preview}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Why Subbies exists — an honest founder note, not a testimonial. */}
      <div className="border-t border-line bg-surface">
        <Section className="py-section">
          <Reveal className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <Image
              src="/marketing/trust-crew.webp"
              alt="Two site supervisors reviewing rebar layout on a job site"
              width={900}
              height={675}
              sizes="(min-width: 1024px) 35vw, 90vw"
              className="aspect-[4/3] w-full rounded-card object-cover grayscale-[35%]"
            />
            <div>
              <Eyebrow>Why Subbies exists</Eyebrow>
              <blockquote className="mt-4 font-display text-2xl font-semibold leading-snug tracking-[-0.02em] sm:text-3xl">
                &ldquo;Built by someone who&apos;s spent real afternoons chasing
                subcontractors for the same insurance certificate twice, because
                there was nowhere it was supposed to live.&rdquo;
              </blockquote>
              <p className="mt-5 max-w-xl text-sm text-ink-muted">
                Subbies isn&apos;t a feature bolted onto a bigger project
                management suite. It does one job: know who&apos;s compliant,
                without the spreadsheet. The screens on this page are built from
                the real product, shown with example data.
              </p>
            </div>
          </Reveal>
        </Section>
      </div>

      {/* Pricing teaser — one honest line and a link. */}
      <div className="border-t border-line">
        <Section className="flex flex-col gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-xl font-semibold sm:text-2xl">
            Plans from A${PLANS.starter.amount} a month.{" "}
            <span className="text-ink-muted">
              No per-contractor fees. {TRIAL_DAYS} days free.
            </span>
          </p>
          <Link
            href="/pricing"
            className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
          >
            Compare plans
            <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </Link>
        </Section>
      </div>

      <CtaBand />
    </>
  );
}
