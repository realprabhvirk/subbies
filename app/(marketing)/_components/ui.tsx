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

/**
 * The one marketing content width: 1440px max, fluid side padding. Nav,
 * every section and the footer use it, so edges line up on every screen.
 */
export const CONTAINER = "mx-auto w-full min-w-0 max-w-[90rem] px-6 sm:px-10 lg:px-16";

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`${CONTAINER} ${className}`}>{children}</div>;
}

/** The marketing content column, as a <section>. */
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
    <section id={id} className={`${CONTAINER} ${className}`}>
      {children}
    </section>
  );
}

const BAND_TONE = {
  canvas: "bg-canvas",
  surface: "bg-surface",
  /** A slightly deeper warm tone, for alternation. */
  deep: "bg-surface-muted",
  /** The sidebar navy, for one key moment per page. */
  navy: "bg-sidebar-bg text-sidebar-ink",
} as const;

/**
 * A full-bleed section band: the background runs edge to edge on wide
 * screens while the content stays in the container. Alternating bands are
 * what stop a wide page reading as one flat, empty sheet.
 */
export function Band({
  tone = "canvas",
  children,
  className = "",
  innerClassName = "",
  id,
  bordered = false,
}: {
  tone?: keyof typeof BAND_TONE;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  id?: string;
  bordered?: boolean;
}) {
  return (
    <section
      id={id}
      data-surface={tone === "navy" ? "sidebar" : undefined}
      className={`${BAND_TONE[tone]} ${bordered ? "border-y border-line" : ""} ${className}`}
    >
      <div className={`${CONTAINER} ${innerClassName}`}>{children}</div>
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
      <h2 className="mt-4 text-[2.125rem] leading-[1.06] tracking-display sm:text-5xl">{title}</h2>
      {intro && <p className="mt-5 max-w-[62ch] text-lg text-ink-muted sm:text-xl">{intro}</p>}
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
    <ButtonLink href={href} variant="outline" size="lg" className="group">
      {children}
      <ArrowRight
        className="h-4 w-4 transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5"
        strokeWidth={2.25}
        aria-hidden
      />
    </ButtonLink>
  );
}

/**
 * Closing call to action: a full-width navy band (the product's own rail
 * colour), heading and one line left, the large inverse buttons right.
 */
export function CtaBand({
  heading = "Stop chasing paperwork",
  sub = "Set up your document checklist and send your first onboarding request in a few minutes.",
  secondary = { href: "/how-it-works", label: "See how it works" },
}: {
  heading?: string;
  sub?: string;
  secondary?: { href: string; label: string } | null;
}) {
  return (
    <Band tone="navy" innerClassName="py-section">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-[2.125rem] leading-[1.05] tracking-display text-sidebar-ink sm:text-5xl">{heading}</h2>
          <p className="mt-4 max-w-[62ch] text-lg text-sidebar-ink-muted sm:text-xl">{sub}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <ButtonLink href="/signup" variant="inverse" size="lg" className="group w-full sm:w-auto">
            Create your account
            <ArrowRight
              className="h-4 w-4 transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5"
              strokeWidth={2.25}
              aria-hidden
            />
          </ButtonLink>
          {secondary && (
            <ButtonLink href={secondary.href} variant="inverse-outline" size="lg" className="w-full sm:w-auto">
              {secondary.label}
            </ButtonLink>
          )}
        </div>
      </div>
    </Band>
  );
}
