import Link from "next/link";

import { Logo } from "@/app/components/logo";
import { CONTAINER } from "./ui";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    title: "Company",
    links: [{ href: "/contact", label: "Contact" }],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/signup", label: "Create account" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

/** Dark navy footer on the shared container, with the brand-size logo. */
export function MarketingFooter() {
  return (
    <footer data-surface="sidebar" className="border-t border-sidebar-border bg-sidebar-bg-deep text-sidebar-ink">
      <div className={`${CONTAINER} grid gap-12 py-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)] lg:py-20`}>
        <div className="max-w-sm">
          <Logo size="brand" tone="inverse" />
          <p className="mt-5 text-base text-sidebar-ink-muted">
            Contractor onboarding and compliance document tracking for trade
            businesses.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="label-caps text-sidebar-ink-muted">{col.title}</p>
              <ul className="mt-4 space-y-1">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="inline-flex min-h-11 items-center text-base font-medium text-sidebar-ink transition-colors hover:text-white hover:underline hover:underline-offset-4"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-sidebar-border">
        <div className={`${CONTAINER} flex flex-wrap items-center justify-between gap-2 py-6 text-sm text-sidebar-ink-muted`}>
          <p>© {new Date().getFullYear()} Subbies</p>
          <p>Prices in AUD.</p>
        </div>
      </div>
    </footer>
  );
}
