import Link from "next/link";
import { Check } from "lucide-react";

import { Logo } from "@/app/components/logo";
import { StatusBadge } from "@/app/components/status-badge";
import type { ContractorStatus } from "@/lib/types";

/**
 * The shared frame for login, signup and the password screens.
 *
 * Form on the left on calm paper; on desktop, the navy panel on the right
 * shows what the product actually is — a small register of contractors with
 * their stamps — rather than a stock photo or a slogan. On a phone the panel
 * is dropped entirely: the form is the job.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:py-8">
        <header>
          <Link href="/" aria-label="Subbies home" className="inline-block rounded-sm">
            <Logo height={28} priority />
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <footer className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
          <span>© {new Date().getFullYear()} Subbies</span>
          <Link href="/privacy" className="hover:text-ink hover:underline">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink hover:underline">
            Terms
          </Link>
          <Link href="/contact" className="hover:text-ink hover:underline">
            Contact
          </Link>
        </footer>
      </div>

      <AuthPanel />
    </main>
  );
}

const SAMPLE: { name: string; trade: string; status: ContractorStatus }[] = [
  { name: "Northside Electrical", trade: "Electrician", status: "approved" },
  { name: "BJ Plumbing & Gas", trade: "Plumber", status: "awaiting_review" },
  { name: "Apex Scaffolding", trade: "Scaffolder", status: "attention_required" },
  { name: "Redline Concreting", trade: "Concreter", status: "expired" },
];

const FACTS = [
  "Contractors upload from one link. No account, no app.",
  "Reminders go out before anything expires.",
  "Files sit in private storage, opened only by short-lived links.",
];

function AuthPanel() {
  return (
    <aside
      data-surface="sidebar"
      aria-hidden
      className="relative hidden overflow-hidden bg-sidebar-bg lg:block"
    >
      {/* Ruled-paper texture: hairlines in the rail's own border colour. */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0, transparent 47px, var(--color-sidebar-border) 47px, var(--color-sidebar-border) 48px)",
        }}
      />
      <div className="relative flex h-full flex-col justify-center px-12 py-16 xl:px-20">
        <p className="label-caps text-sidebar-ink-muted">The compliance register</p>
        <p className="mt-4 max-w-lg font-display text-3xl font-bold leading-[1.08] tracking-display text-sidebar-ink xl:text-4xl">
          Know who&apos;s cleared for site before they arrive.
        </p>

        <div className="mt-10 max-w-md overflow-hidden rounded-card border border-sidebar-border bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line bg-surface-muted px-4 py-2.5">
            <span className="label-caps text-ink-muted">Contractors</span>
            <span className="font-mono text-2xs text-ink-subtle">Example</span>
          </div>
          <ul className="divide-y divide-line">
            {SAMPLE.map((row) => (
              <li key={row.name} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{row.name}</p>
                  <p className="truncate text-xs text-ink-muted">{row.trade}</p>
                </div>
                <StatusBadge kind="contractor" status={row.status} size="sm" />
              </li>
            ))}
          </ul>
        </div>

        <ul className="mt-10 max-w-md space-y-3">
          {FACTS.map((fact) => (
            <li key={fact} className="flex items-start gap-2.5 text-sm text-sidebar-ink-muted">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-ink" strokeWidth={2.5} />
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/** Title block used at the top of each auth form. */
export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl">{title}</h1>
      {description && <p className="mt-2 text-sm text-ink-muted">{description}</p>}
    </div>
  );
}
