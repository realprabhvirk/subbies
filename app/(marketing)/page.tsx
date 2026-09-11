import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Section, Eyebrow, Reveal, PrimaryLink, CtaBand } from "./_components/ui";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { PlaceholderImage } from "./_components/placeholder-image";
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

type StepVisual = "photo-onboard" | "upload" | "review" | "photo-track";

const STEPS: { title: string; body: string; visual: StepVisual }[] = [
  {
    title: "Onboard",
    body: "Add a contractor, choose which documents you need, and send one secure link.",
    visual: "photo-onboard",
  },
  {
    title: "Collect",
    body: "They upload everything from their phone. No login, no account, no app to install.",
    visual: "upload",
  },
  {
    title: "Review",
    body: "Check each document, set its expiry date, approve or send it back with a reason.",
    visual: "review",
  },
  {
    title: "Track",
    body: "Everyone's status stays current, and reminders go out before anything expires.",
    visual: "photo-track",
  },
];

const FEATURES = [
  {
    title: "No contractor logins",
    body: "Every competing tool asks the contractor to make an account. That's the step where onboarding stalls — Subbies is one link, nothing to sign up for.",
    preview: <UploadPreview />,
  },
  {
    title: "Automatic expiry reminders",
    body: "Set an expiry when you approve a document. Subbies reminds the contractor before it lapses, and escalates to you if they ignore it.",
    preview: <ReminderPreview />,
  },
  {
    title: "One compliance dashboard",
    body: "Every certificate, licence, and insurance document for every contractor, reviewed and tracked from one screen — not a shared spreadsheet.",
    preview: <ProductPreview />,
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero — full-bleed photo slot with a dark scrim for legible text.
          The scrim is a plain top-to-bottom gradient over a real photo, which
          is not the same thing as a decorative gradient-blob background —
          it's doing a job (contrast), not decoration. */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <PlaceholderImage
            label="Hero image"
            spec="1920×1080 · wide job-site, crew, or builder-at-work shot"
            dark
            className="h-full w-full"
          />
          {/* Swap-in note: once a real photo lands at this path, replace
              PlaceholderImage above with next/image (fill + object-cover)
              inside this same absolutely-positioned wrapper — the scrim
              below needs no change. */}
          <div className="absolute inset-0 bg-gradient-to-t from-warm-900/85 via-warm-900/55 to-warm-900/20" />
        </div>

        <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 sm:py-32 lg:py-40">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/70">
              Contractor onboarding &amp; compliance
            </p>
            <h1 className="mt-4 text-[2.6rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl">
              Stop chasing contractors for paperwork
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/85">
              Collect insurance certificates, licences, and workers comp from
              your subcontractors, review them in one place, and know at a
              glance who is approved to work.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <PrimaryLink href="/signup">Start free</PrimaryLink>
              <Link
                href="/how-it-works"
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-white/90 transition-colors duration-[var(--duration-fast)] hover:text-white"
              >
                See how it works
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-standard)] group-hover:translate-x-0.5"
                  strokeWidth={2}
                  aria-hidden
                />
              </Link>
            </div>
            <p className="mt-5 text-sm text-white/60">
              {TRIAL_DAYS} days free on any plan, cancel any time. Built for
              builders, property maintenance, and facilities teams.
            </p>
          </div>
        </div>
      </section>

      {/* The problem — text-led, deliberately light on imagery. The photo
          did the confidence-building in the hero; this section's job is to
          name the pain plainly and move on. */}
      <Section className="py-16 sm:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Eyebrow>The problem</Eyebrow>
          <h2 className="mt-3 text-2xl font-semibold sm:text-[2rem]">
            You&apos;re not short on subcontractors. You&apos;re short on
            certainty about them.
          </h2>
          <p className="mt-4 text-ink-muted">
            Insurance certificates that quietly lapse. A licence you meant to
            check before the job started. A spreadsheet three people are
            editing at once, none of them sure which version is current. It
            costs an afternoon every time you chase it down, and it&apos;s
            invisible right up until it isn&apos;t — an expired policy on
            site, discovered at the worst possible moment.
          </p>
        </Reveal>
      </Section>

      {/* How it works — each step paired with either the real product UI or
          a supporting photo, never an icon standing in on its own. */}
      <div className="border-y border-line bg-surface">
        <Section className="py-16 sm:py-20">
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold sm:text-[2rem]">
              From &ldquo;we need someone Monday&rdquo; to approved, without
              the back-and-forth
            </h2>
          </Reveal>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <Reveal key={step.title}>
                <li className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-canvas shadow-sm">
                  {/* The two photo slots get a fixed 4:3 box (that's the shot
                      to source). The two product-UI mockups render at their
                      own natural height instead of being force-fit into the
                      same ratio — they're real card chrome, not a photo, and
                      cropping one to 4:3 would just clip rows off it. */}
                  <div className="shrink-0 p-4 pb-0">
                    {step.visual === "photo-onboard" && (
                      <PlaceholderImage
                        label="Onboarding photo"
                        spec="4:3 · adding a contractor on site or in the office"
                        className="aspect-[4/3] w-full rounded-md"
                      />
                    )}
                    {step.visual === "photo-track" && (
                      <PlaceholderImage
                        label="Craftsmanship photo"
                        spec="4:3 · close-up trade detail"
                        className="aspect-[4/3] w-full rounded-md"
                      />
                    )}
                    {step.visual === "upload" && (
                      <div aria-hidden className="overflow-hidden rounded-md">
                        <UploadPreview />
                      </div>
                    )}
                    {step.visual === "review" && (
                      <div aria-hidden className="overflow-hidden rounded-md">
                        <ProductPreview />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                        Step {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-lg font-semibold">{step.title}</h3>
                    <p className="mt-1.5 text-sm text-ink-muted">{step.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </Section>
      </div>

      {/* Trust — the weakest part of most pre-launch SaaS marketing. No logo
          wall we don't have yet; a concrete, honest angle instead. */}
      <Section className="py-16 sm:py-20">
        <Reveal>
          <div className="grid items-center gap-10 rounded-card border border-line bg-surface p-6 shadow-sm sm:p-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="mx-auto w-full max-w-[13rem] lg:mx-0">
              <PlaceholderImage
                label="Founder photo"
                spec="1:1 · optional"
                className="aspect-square w-full rounded-full"
              />
            </div>
            <div>
              <Eyebrow>Why Subbies exists</Eyebrow>
              <p className="mt-3 text-xl font-medium leading-relaxed text-ink sm:text-2xl">
                &ldquo;Built by someone who&apos;s spent real afternoons
                chasing subcontractors for the same insurance certificate
                twice, because there was nowhere it was supposed to live.&rdquo;
              </p>
              <p className="mt-4 text-sm text-ink-muted">
                Subbies isn&apos;t a feature bolted onto a bigger project
                management suite — it&apos;s built for exactly one job: know
                who&apos;s compliant, without the spreadsheet. What you see
                on this page is the real product, not a mockup of one.
              </p>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* Feature highlights — real screenshots, not stock icons. */}
      <div className="border-y border-line bg-surface">
        <Section className="py-16 sm:py-20">
          <Reveal>
            <Eyebrow>What you get</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold sm:text-[2rem]">
              The parts that actually take time, handled
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Reveal key={f.title} className="h-full">
                <div className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-canvas shadow-sm">
                  <div aria-hidden className="p-4 pb-0">
                    {f.preview}
                  </div>
                  <div className="p-5">
                    <h3 className="text-base font-semibold">{f.title}</h3>
                    <p className="mt-1.5 text-sm text-ink-muted">{f.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>
      </div>

      <CtaBand />
    </>
  );
}
