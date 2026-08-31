import type { Metadata } from "next";
import Image from "next/image";
import {
  Send,
  Inbox,
  ClipboardCheck,
  CalendarClock,
  ShieldCheck,
  FolderKanban,
  MailX,
  CircleCheck,
  TriangleAlert,
  Clock,
} from "lucide-react";

import {
  Section,
  Eyebrow,
  Reveal,
  PrimaryLink,
  SecondaryLink,
  CtaBand,
} from "./_components/ui";
import { ProductPreview } from "./_components/product-preview";

export const metadata: Metadata = {
  title: {
    absolute: "Subbies — contractor onboarding & compliance tracking",
  },
  description:
    "Stop chasing contractors for paperwork and know whether they're approved to work. Collect, review, and track compliance documents in one place.",
};

const STEPS = [
  {
    icon: Send,
    title: "Onboard",
    body: "Add a contractor, choose which documents you need, and send one secure link.",
  },
  {
    icon: Inbox,
    title: "Collect",
    body: "They upload everything from their phone — no login, no account, no app to install.",
  },
  {
    icon: ClipboardCheck,
    title: "Review",
    body: "Check each document, set its expiry date, approve or send it back with a reason.",
  },
  {
    icon: CalendarClock,
    title: "Track",
    body: "Everyone's status stays current, and reminders go out before anything expires.",
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "One place to review",
    body: "Every certificate, licence, and insurance document for every contractor — reviewed and approved from one screen.",
  },
  {
    icon: CalendarClock,
    title: "Expiry tracking",
    body: "Set an expiry when you approve a document. Subbies reminds the contractor before it lapses and escalates to you if they ignore it.",
  },
  {
    icon: FolderKanban,
    title: "Projects",
    body: "See who's assigned to each job and confirm they're compliant before they're on site.",
  },
];

const CREW = [
  { name: "Northside Electrical", role: "Electrical", status: "ok" as const },
  { name: "BJ Plumbing & Gas", role: "Plumbing", status: "review" as const },
  { name: "Apex Scaffolding", role: "Scaffolding", status: "attention" as const },
];

const CREW_STATUS = {
  ok: { label: "Approved", icon: CircleCheck, cls: "text-approved bg-approved-bg" },
  review: { label: "Awaiting review", icon: Clock, cls: "text-review bg-review-bg" },
  attention: {
    label: "Attention",
    icon: TriangleAlert,
    cls: "text-attention bg-attention-bg",
  },
};

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <Section className="pt-14 pb-16 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <Eyebrow>Contractor onboarding &amp; compliance</Eyebrow>
            <h1 className="mt-4 text-[2.6rem] font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              Stop chasing contractors for paperwork
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-muted">
              Collect insurance certificates, licences, and workers comp from
              your subcontractors, review them in one place, and know at a glance
              who is approved to work.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink href="/signup">Start free trial</PrimaryLink>
              <SecondaryLink href="/how-it-works">See how it works</SecondaryLink>
            </div>
            <p className="mt-4 text-sm text-ink-subtle">
              7-day free trial on every plan. Built for builders, property
              maintenance, and facilities teams.
            </p>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-card border border-line shadow-sm">
              <Image
                src="/marketing/blueprint.jpg"
                alt="A builder marking up a set of plans"
                width={1400}
                height={788}
                priority
                sizes="(min-width: 1024px) 46vw, 100vw"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-8 -left-6 hidden w-[19rem] sm:block">
              <ProductPreview />
            </div>
          </div>
        </div>
      </Section>

      {/* How it works */}
      <div className="border-y border-line bg-surface">
        <Section className="py-18 py-16">
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold sm:text-[2rem]">
              From &ldquo;we need someone Monday&rdquo; to approved, without the
              back-and-forth
            </h2>
          </Reveal>
          <ol className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.title} className="relative">
                  <li>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-semibold text-line-strong tabular-nums">
                        {i + 1}
                      </span>
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
                        <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                    <p className="mt-1.5 text-sm text-ink-muted">{step.body}</p>
                  </li>
                </Reveal>
              );
            })}
          </ol>
        </Section>
      </div>

      {/* Contractor-side / projects — photo + product UI */}
      <Section className="py-16 sm:py-20">
        <Reveal>
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Eyebrow>On the job</Eyebrow>
              <h2 className="mt-3 text-2xl font-semibold sm:text-[2rem]">
                Know everyone on site is cleared to work
              </h2>
              <p className="mt-4 text-ink-muted">
                Assign contractors to a project and Subbies shows their live
                compliance status right there. No cross-checking spreadsheets
                before a site walk — one screen tells you who&apos;s good to go
                and who isn&apos;t.
              </p>
              <p className="mt-3 text-ink-muted">
                And the contractor never has to log in. They get a single
                emailed link, upload from their phone, and you review it.
              </p>
              <div className="mt-6">
                <SecondaryLink href="/how-it-works">
                  See the full workflow
                </SecondaryLink>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-card border border-line shadow-sm">
              <Image
                src="/marketing/crew.jpg"
                alt="A site supervisor with a crew of contractors on a concrete slab"
                width={1400}
                height={933}
                sizes="(min-width: 1024px) 46vw, 100vw"
                className="h-72 w-full object-cover sm:h-80"
              />
              <div className="absolute inset-x-3 bottom-3 rounded-md border border-line bg-surface/95 p-3 backdrop-blur">
                <p className="px-1 pb-1.5 text-xs font-medium text-ink-subtle">
                  Smith Street — on site
                </p>
                <ul className="space-y-1">
                  {CREW.map((c) => {
                    const s = CREW_STATUS[c.status];
                    const Icon = s.icon;
                    return (
                      <li
                        key={c.name}
                        className="flex items-center justify-between gap-2 rounded px-1 py-1 text-xs"
                      >
                        <span className="truncate font-medium">{c.name}</span>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-medium ${s.cls}`}
                        >
                          <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
                          {s.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* No contractor logins — the wide feature */}
      <div className="border-y border-line bg-surface">
        <Section className="py-16">
          <Reveal>
            <div className="grid gap-8 rounded-card border border-line bg-canvas p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
                  <MailX className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <h3 className="mt-4 text-xl font-semibold">
                  No contractor logins
                </h3>
                <p className="mt-2 max-w-md text-ink-muted">
                  Every competing tool asks the contractor to make an account.
                  That&apos;s the step where onboarding stalls. Subbies is one
                  link — nothing to sign up for, nothing to install.
                </p>
              </div>
              <div className="rounded-md border border-line bg-surface p-4 text-sm shadow-sm">
                <p className="font-medium text-brand-ink">
                  Northside Builders — documents needed before you start work
                </p>
                <p className="mt-2 text-ink-muted">
                  Hi Dave, please provide:
                </p>
                <ul className="mt-2 list-disc pl-5 text-ink-muted">
                  <li>Public Liability insurance</li>
                  <li>Electrical licence</li>
                  <li>Workers compensation</li>
                </ul>
                <span className="mt-4 inline-flex rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white">
                  Upload your documents
                </span>
              </div>
            </div>
          </Reveal>
        </Section>
      </div>

      {/* Feature grid */}
      <Section className="py-16">
        <Reveal>
          <Eyebrow>What you get</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-2xl font-semibold sm:text-[2rem]">
            The parts that actually take time, handled
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Reveal key={f.title}>
                <div className="h-full rounded-card border border-line bg-surface p-6">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
                    <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-muted">{f.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
