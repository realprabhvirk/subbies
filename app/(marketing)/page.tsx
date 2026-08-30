import type { Metadata } from "next";
import {
  Send,
  Inbox,
  ClipboardCheck,
  CalendarClock,
  ShieldCheck,
  FolderKanban,
  MailX,
} from "lucide-react";

import { Section, Eyebrow, PrimaryLink, SecondaryLink, CtaBand } from "./_components/ui";
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
    icon: MailX,
    title: "No contractor logins",
    body: "Contractors interact through a single emailed link. Nothing to sign up for kills the friction that stalls onboarding.",
  },
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

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <Section className="pt-16 pb-14 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Eyebrow>Contractor onboarding &amp; compliance</Eyebrow>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Stop chasing contractors for paperwork
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-muted">
              Collect insurance certificates, licences, and workers comp from
              your subcontractors, review them in one place, and know at a glance
              who is approved to work.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink href="/signup">Get started</PrimaryLink>
              <SecondaryLink href="/how-it-works">See how it works</SecondaryLink>
            </div>
            <p className="mt-4 text-sm text-ink-subtle">
              Built for builders, property maintenance, and facilities teams.
            </p>
          </div>
          <ProductPreview />
        </div>
      </Section>

      {/* How it works */}
      <div className="border-y border-line bg-surface">
        <Section className="py-16">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-2xl font-semibold sm:text-3xl">
            From &ldquo;we need someone to start Monday&rdquo; to approved, without
            the back-and-forth
          </h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="relative">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-tint text-brand-ink">
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="text-sm font-semibold text-ink-subtle">
                      Step {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-muted">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </Section>
      </div>

      {/* Features */}
      <Section className="py-16">
        <Eyebrow>What you get</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-2xl font-semibold sm:text-3xl">
          The parts that actually take time, handled
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-card border border-line bg-surface p-6"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand-tint text-brand-ink">
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-ink-muted">{f.body}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Contractor side */}
      <div className="border-y border-line bg-surface">
        <Section className="py-16">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Eyebrow>The contractor&apos;s side</Eyebrow>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
                One link. No account.
              </h2>
              <p className="mt-4 text-ink-muted">
                Contractors get a plain, professional email with a secure link.
                They open it, see exactly what&apos;s needed, and upload each
                document from their phone. If something&apos;s wrong, they get one
                clear reason and the same link to try again.
              </p>
              <p className="mt-3 text-ink-muted">
                Nothing to remember, nothing to install. That&apos;s the
                difference between paperwork that comes back and paperwork that
                doesn&apos;t.
              </p>
            </div>
            <div className="rounded-card border border-line bg-canvas p-5">
              <div className="rounded-md border border-line bg-surface p-4 text-sm">
                <p className="font-medium text-brand-ink">
                  Northside Builders — documents needed before you start work
                </p>
                <p className="mt-2 text-ink-muted">
                  Hi Dave, Northside Builders uses Subbies to collect contractor
                  compliance documents. Please provide:
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
          </div>
        </Section>
      </div>

      <CtaBand />
    </>
  );
}
