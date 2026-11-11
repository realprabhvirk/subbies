import type { Metadata } from "next";
import Image from "next/image";
import { BellRing, Check, ClipboardCheck, FileCheck, History, Link2 } from "lucide-react";

import {
  Band,
  Section,
  SectionHead,
  Eyebrow,
  Reveal,
  PrimaryLink,
  SecondaryLink,
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

// What the product does, stated plainly: no stats, logos or testimonials.
const PROOF = [
  { icon: Link2, label: "Secure upload links", line: "No contractor logins. Photos or PDFs from any phone." },
  { icon: BellRing, label: "Expiry reminders", line: "Sent on the schedule you set for each document type." },
  { icon: ClipboardCheck, label: "Review in one place", line: "Approve with an expiry date, or reject with a reason." },
  { icon: History, label: "Full document history", line: "Replaced and archived copies stay on record." },
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
      {/* Hero: fills the first screen under the nav on desktop, content
          centred. The ruled background (the "register" motif) is the one
          texture. */}
      <section className="relative isolate overflow-hidden border-b border-line lg:flex lg:min-h-[calc(100svh-5rem)] lg:items-center">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, transparent 0, transparent 39px, var(--color-line) 39px, var(--color-line) 40px)",
          }}
        />
        <Section className="grid grid-cols-[minmax(0,1fr)] items-center gap-14 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16 lg:py-16">
          <div>
            <Eyebrow>Contractor onboarding &amp; compliance</Eyebrow>
            <h1 className="mt-5 max-w-[14ch] text-[2.6rem] leading-[0.98] tracking-display sm:text-6xl lg:text-[4.25rem] xl:text-[5rem]">
              Stop chasing paperwork. Know who&apos;s cleared for site.
            </h1>
            <p className="mt-7 max-w-[34rem] text-lg text-ink-muted sm:text-xl xl:text-[1.375rem] xl:leading-[1.5]">
              Collect insurance certificates, licences and workers comp from your
              subcontractors, review them in one place, and see at a glance
              who is approved to work.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <PrimaryLink href="/signup">Start {TRIAL_DAYS}-day free trial</PrimaryLink>
              <SecondaryLink href="/how-it-works">See how it works</SecondaryLink>
            </div>
            <p className="mt-6 text-base text-ink-muted">
              Card required, nothing charged for {TRIAL_DAYS} days. Built for
              builders, property maintenance and facilities teams.
            </p>
          </div>

          {/* Product composite, scaled up with the screen so it holds the
              right half. The notification card is the moment the product
              exists for, labelled as an example like the panel. */}
          <div aria-hidden className="relative mx-auto w-full max-w-xl sm:pt-20 lg:max-w-none lg:[zoom:1.12] xl:[zoom:1.25]">
            <ProductPreview />
            <div className="absolute -left-4 top-0 hidden w-80 items-start gap-3 rounded-card border border-line bg-surface p-3.5 shadow-lg sm:flex xl:-left-10">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-review-line bg-review-bg text-review">
                <FileCheck className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">
                  BJ Plumbing &amp; Gas uploaded Public liability insurance
                </p>
                <p className="mt-1 flex justify-between font-mono text-2xs text-ink-subtle">
                  <span>just now</span>
                  <span>Example</span>
                </p>
              </div>
            </div>
          </div>
        </Section>
      </section>

      {/* Proof strip: what Subbies does, in four plain lines. */}
      <Band tone="surface" className="border-b border-line">
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.map((p, i) => {
            const Icon = p.icon;
            return (
              <li
                key={p.label}
                className={`flex gap-4 py-7 sm:py-9 ${i > 0 ? "border-t border-line sm:border-t-0" : ""} ${
                  i % 2 === 1 ? "sm:border-l sm:pl-8" : ""
                } ${i >= 2 ? "sm:border-t lg:border-t-0" : ""} ${i === 2 ? "lg:border-l lg:pl-8" : ""} ${i === 3 ? "lg:pl-8" : ""} sm:pr-6`}
              >
                <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <div>
                  <p className="font-display text-lg font-semibold sm:text-xl">{p.label}</p>
                  <p className="mt-1 text-base text-ink-muted">{p.line}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Band>

      {/* The problem — named plainly, in two columns: the claim, the cost. */}
      <Band tone="deep" innerClassName="py-section">
        <Reveal className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <SectionHead
            index="01"
            label="The problem"
            title="You're not short on subbies. You're short on certainty about them."
          />
          <div className="max-w-[62ch] space-y-5 text-lg text-ink-muted sm:text-xl lg:pt-16">
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
      </Band>

      {/* How it works — four ruled, numbered steps. */}
      <Band tone="surface" bordered innerClassName="py-section">
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
                <span className="figure text-5xl text-line-strong">0{i + 1}</span>
                <h3 className="mt-4 text-2xl">{step.title}</h3>
                <p className="mt-2 text-base text-ink-muted sm:text-lg">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12">
            <SecondaryLink href="/how-it-works">The full walkthrough</SecondaryLink>
          </div>
      </Band>

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
              <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:gap-24">
                <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                  <Eyebrow className="text-brand">{f.label}</Eyebrow>
                  <h3 className="mt-3 text-3xl leading-tight tracking-display sm:text-[2.75rem]">
                    {f.title}
                  </h3>
                  <p className="mt-5 max-w-[62ch] text-lg text-ink-muted">{f.body}</p>
                  <ul className="mt-7 max-w-xl divide-y divide-line border-y border-line">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-center gap-3 py-3 text-base">
                        <Check className="h-5 w-5 shrink-0 text-brand" strokeWidth={2.5} aria-hidden />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div aria-hidden className={`mx-auto w-full max-w-md lg:[zoom:1.12] xl:[zoom:1.25] ${i % 2 === 1 ? "lg:order-1" : ""}`}>
                  {f.preview}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Why Subbies exists — an honest founder note, not a testimonial. */}
      <Band tone="deep" className="border-t border-line" innerClassName="py-section">
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
              <blockquote className="mt-4 font-display text-2xl font-semibold leading-snug tracking-[-0.02em] sm:text-[2.25rem] sm:leading-[1.25]">
                &ldquo;Built by someone who&apos;s spent real afternoons chasing
                subcontractors for the same insurance certificate twice, because
                there was nowhere it was supposed to live.&rdquo;
              </blockquote>
              <p className="mt-6 max-w-[62ch] text-lg text-ink-muted">
                Subbies isn&apos;t a feature bolted onto a bigger project
                management suite. It does one job: know who&apos;s compliant,
                without the spreadsheet. The screens on this page are built from
                the real product, shown with example data.
              </p>
            </div>
          </Reveal>
      </Band>

      {/* Pricing teaser — one honest line and a link. */}
      <Band tone="surface" className="border-t border-line" innerClassName="flex flex-col gap-6 py-12 sm:flex-row sm:items-center sm:justify-between lg:py-16">
          <p className="font-display text-2xl font-semibold sm:text-3xl">
            Plans from A${PLANS.starter.amount} a month.{" "}
            <span className="text-ink-muted">
              No per-contractor fees. {TRIAL_DAYS} days free.
            </span>
          </p>
          <SecondaryLink href="/pricing">Compare plans</SecondaryLink>
      </Band>

      <CtaBand />
    </>
  );
}
