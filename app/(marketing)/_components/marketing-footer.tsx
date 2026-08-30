import Link from "next/link";

import { Logo } from "@/app/components/logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-sm text-ink-muted">
            Contractor onboarding and compliance document tracking for trade
            businesses.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm">
          <Link href="/how-it-works" className="text-ink-muted hover:text-ink">
            How it works
          </Link>
          <Link href="/pricing" className="text-ink-muted hover:text-ink">
            Pricing
          </Link>
          <Link href="/contact" className="text-ink-muted hover:text-ink">
            Contact
          </Link>
          <Link href="/login" className="text-ink-muted hover:text-ink">
            Log in
          </Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-5xl px-4 py-4 text-xs text-ink-subtle sm:px-6">
          © {new Date().getFullYear()} Subbies
        </p>
      </div>
    </footer>
  );
}
