import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-wide text-brand">
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

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
    >
      {children}
      <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
    </Link>
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
    <Link
      href={href}
      className="inline-flex items-center rounded-md border border-line-strong px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
    >
      {children}
    </Link>
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
      <div className="rounded-card border border-brand-ink/10 bg-brand-ink px-6 py-12 text-center sm:px-12">
        <h2 className="text-2xl font-semibold text-ink-inverse sm:text-3xl">
          {heading}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-inverse/80 sm:text-base">
          {sub}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-md bg-surface px-5 py-2.5 text-sm font-medium text-brand-ink transition-colors hover:bg-surface-muted"
          >
            Create your account
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center rounded-md border border-ink-inverse/25 px-5 py-2.5 text-sm font-medium text-ink-inverse transition-colors hover:bg-ink-inverse/10"
          >
            See how it works
          </Link>
        </div>
      </div>
    </Section>
  );
}
