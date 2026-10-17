import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ButtonLink } from "@/app/components/button";

/** 12px caps label above a section heading. */
export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <p className={`label-caps text-ink-muted ${className}`}>{children}</p>;
}

/** Eases its children in as they scroll into view (progressive, never hides). */
export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`reveal ${className}`}>{children}</div>;
}

/** The marketing content column — wider than the app's, for editorial layouts. */
export function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </section>
  );
}

/**
 * A numbered section head: mono index, caps label, a big semi-expanded
 * heading. Left-set — the marketing site reads like a document, not a
 * centred landing-page template.
 */
export function SectionHead({
  index,
  label,
  title,
  intro,
  className = "",
}: {
  index?: string;
  label: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`max-w-3xl ${className}`}>
      <p className="flex items-center gap-3 text-ink-muted">
        {index && <span className="font-mono text-xs">{index}</span>}
        {index && <span aria-hidden className="h-px w-8 bg-line-strong" />}
        <span className="label-caps">{label}</span>
      </p>
      <h2 className="mt-4 text-3xl leading-[1.08] tracking-display sm:text-5xl">{title}</h2>
      {intro && <p className="mt-5 max-w-2xl text-base text-ink-muted">{intro}</p>}
    </div>
  );
}

// Both link helpers are thin wrappers around the shared Button primitives
// (app/components/button.tsx) rather than a marketing-only button style.

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <ButtonLink href={href} size="lg" className="group">
      {children}
      <ArrowRight
        className="h-4 w-4 transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5"
        strokeWidth={2.25}
        aria-hidden
      />
    </ButtonLink>
  );
}

export function SecondaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <ButtonLink href={href} variant="secondary" size="lg">
      {children}
    </ButtonLink>
  );
}

/**
 * Closing call to action: a full-width navy band (the product's own rail
 * colour) with the heading set large and left, buttons right.
 */
export function CtaBand({
  heading = "Stop chasing paperwork",
  sub = "Set up your document checklist and send your first onboarding request in a few minutes.",
}: {
  heading?: string;
  sub?: string;
}) {
  return (
    <div data-surface="sidebar" className="bg-sidebar-bg">
      <Section className="py-section">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl leading-[1.05] tracking-display text-sidebar-ink sm:text-5xl">
              {heading}
            </h2>
            <p className="mt-4 text-base text-sidebar-ink-muted">{sub}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            {/* Inverted buttons for the dark band — written out rather than
                overriding ButtonLink's variant colours, which would leave the
                winner to stylesheet order. */}
            <Link
              href="/signup"
              className="pressable group inline-flex h-13 items-center gap-2.5 rounded-md bg-sidebar-ink px-6 text-base font-semibold text-sidebar-bg hover:bg-surface"
            >
              Create your account
              <ArrowRight
                className="h-4 w-4 transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5"
                strokeWidth={2.25}
                aria-hidden
              />
            </Link>
            <Link
              href="/how-it-works"
              className="pressable inline-flex h-13 items-center rounded-md border border-sidebar-border px-6 text-base font-semibold text-sidebar-ink hover:bg-sidebar-bg-elevated"
            >
              See how it works
            </Link>
          </div>
        </div>
      </Section>
    </div>
  );
}
