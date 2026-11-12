import type { Metadata } from "next";
import Image from "next/image";
import { FileCheck } from "lucide-react";

import { Band, Section, H2, PrimaryLink, SecondaryLink, CtaBand } from "./_components/ui";
import { InView, StoryScroller } from "./_components/motion";
import { TRIAL_DAYS, PLANS } from "@/lib/billing/plans";
import { ProductPreview } from "./_components/product-preview";
import { UploadPreview } from "./_components/upload-preview";
import { ReminderPreview } from "./_components/reminder-preview";
import { RequestPreview, ReviewPreview } from "./_components/step-previews";

export const metadata: Metadata = {
  title: {
    absolute: "Subbies: contractor onboarding & compliance tracking",
  },
  description:
    "Stop chasing contractors for paperwork and know whether they're approved to work. Collect, review, and track compliance documents in one place.",
};

const STEPS = [
  { title: "Send one link", body: "Pick the documents you need. Subbies emails the contractor a secure link.", visual: <RequestPreview /> },
  { title: "They upload from their phone", body: "No account, no app. A photo of the certificate is fine.", visual: <UploadPreview /> },
  { title: "Approve or send it back", body: "Set the expiry and approve, or reject with a reason.", visual: <ReviewPreview /> },
  { title: "Stay ahead of expiry", body: "Reminders go out before anything lapses.", visual: <ReminderPreview /> },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero. Text rises in on load; the product composite eases back as
          the page scrolls. The ruled background is the one texture. */}
      <section className="relative isolate overflow-hidden border-b border-line lg:flex lg:min-h-[calc(100svh-4.5rem)] lg:items-center">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, transparent 0, transparent 39px, var(--color-line) 39px, var(--color-line) 40px)",
          }}
        />
        <Section className="grid grid-cols-[minmax(0,1fr)] items-center gap-14 py-14 sm:py-20 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
          <div>
            <h1 className="rise max-w-[15ch] text-[2.375rem] leading-[1.02] tracking-display sm:text-5xl lg:text-[3.5rem] xl:text-[4rem]">
              Stop chasing paperwork. Know who&apos;s cleared for site.
            </h1>
            <p className="rise mt-6 max-w-[30rem] text-lg text-ink-muted [--anim-delay:120ms]">
              Collect insurance, licences and workers comp from your
              subcontractors. See who&apos;s approved to work.
            </p>
            <div className="rise mt-9 flex flex-col gap-3 [--anim-delay:220ms] sm:flex-row sm:flex-wrap sm:items-center">
              <PrimaryLink href="/signup">Start {TRIAL_DAYS}-day free trial</PrimaryLink>
              <SecondaryLink href="/how-it-works">See how it works</SecondaryLink>
            </div>
            <p className="rise mt-5 text-sm text-ink-subtle [--anim-delay:300ms]">
              Nothing charged for {TRIAL_DAYS} days. Cancel any time.
            </p>
          </div>

          <div aria-hidden className="relative mx-auto w-full max-w-xl pt-16 [perspective:1600px] lg:max-w-[40rem]">
            <div className="hero-drift">
              <div className="rise [--anim-delay:180ms]">
                <ProductPreview />
              </div>
            </div>
            <div className="pop-in absolute left-0 top-0 hidden w-80 items-start gap-3 rounded-card border border-line bg-surface p-3.5 shadow-lg [--anim-delay:900ms] sm:flex lg:-left-8">
              <span className="ping mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-review-line bg-review-bg text-review">
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

      {/* The whole flow as one pinned scroll story. */}
      <Band tone="surface" className="border-b border-line" innerClassName="py-section">
        <InView>
          <h2 className={`max-w-[20ch] ${H2}`}>From &ldquo;we need someone Monday&rdquo; to approved.</h2>
        </InView>
        <div className="mt-6 lg:mt-0">
          <StoryScroller steps={STEPS} />
        </div>
      </Band>

      {/* Why Subbies exists: an honest founder note, not a testimonial. */}
      <Band tone="deep" innerClassName="py-section">
        <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-20">
          <InView anim="scale">
            <Image
              src="/marketing/trust-crew.webp"
              alt="Two site supervisors reviewing rebar layout on a job site"
              width={900}
              height={675}
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="aspect-[4/3] w-full rounded-card object-cover grayscale-[35%]"
            />
          </InView>
          <InView delay={120}>
            <blockquote className="font-display text-2xl font-semibold leading-snug tracking-[-0.02em] sm:text-[2rem] sm:leading-[1.25]">
              &ldquo;Built by someone who&apos;s spent real afternoons chasing
              subcontractors for the same insurance certificate twice.&rdquo;
            </blockquote>
            <p className="mt-5 text-sm text-ink-muted">
              Screens on this page are the real product, shown with example data.
            </p>
          </InView>
        </div>
      </Band>

      {/* Pricing in one line. */}
      <Band tone="surface" className="border-t border-line" innerClassName="flex flex-col gap-5 py-12 sm:flex-row sm:items-center sm:justify-between">
        <InView>
          <p className="font-display text-2xl font-semibold sm:text-[1.75rem]">
            From A${PLANS.starter.amount} a month.{" "}
            <span className="text-ink-muted">No per-contractor fees.</span>
          </p>
        </InView>
        <SecondaryLink href="/pricing">Compare plans</SecondaryLink>
      </Band>

      <CtaBand />
    </>
  );
}
