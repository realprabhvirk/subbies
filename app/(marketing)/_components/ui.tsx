import { ArrowRight } from "lucide-react";

import { ButtonLink } from "@/app/components/button";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
      {children}
    </p>
  );
}

/** Fades/slides its children in as they scroll into view (progressive). */
export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`reveal ${className}`}>{children}</div>;
}

export function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto max-w-5xl px-4 sm:px-6 ${className}`}>
      {children}
    </section>
  );
}

// Both link helpers below are thin wrappers around the shared Button
// primitives (app/components/button.tsx) rather than a second, marketing-only
// button style — so the hover lift/shadow treatment defined once there
// reaches every marketing page through this one file, and a future change to
// how buttons feel doesn't need a separate marketing-side edit.

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <ButtonLink href={href} size="lg">
      {children}
      <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
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

export function CtaBand({
  heading = "Stop chasing paperwork",
  sub = "Set up your document checklist and send your first onboarding request in a few minutes.",
}: {
  heading?: string;
  sub?: string;
}) {
  return (
    <Section className="py-16">
      <div className="overflow-hidden rounded-card border border-line bg-surface px-6 py-14 text-center shadow-md sm:px-12">
        <h2 className="text-2xl font-semibold sm:text-3xl">{heading}</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-muted sm:text-base">
          {sub}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <PrimaryLink href="/signup">Create your account</PrimaryLink>
          <SecondaryLink href="/how-it-works">See how it works</SecondaryLink>
        </div>
      </div>
    </Section>
  );
}
