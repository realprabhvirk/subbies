"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";

import { Logo } from "@/app/components/logo";
import { buttonClasses } from "@/app/components/button-styles";
import { CONTAINER } from "./ui";

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

/**
 * The marketing nav: 80px (72px on phones), sticky, solid cream with a
 * hairline, brand-size logo, 18px links with a clear active state, and a
 * real navy "Start free trial" button. Same container as every section.
 */
export function MarketingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas">
      <div className={`${CONTAINER} flex h-16 items-center justify-between gap-6 lg:h-[72px]`}>
        <Link href="/" aria-label="Subbies home" className="rounded-md">
          <Logo size="brand" priority />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-2 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center rounded-md px-3 text-[15px] font-medium transition-colors ${
                  active ? "text-ink" : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                }`}
              >
                {l.label}
                {active && <span aria-hidden className="absolute inset-x-3.5 bottom-1 h-0.5 rounded-full bg-brand" />}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-md px-3 text-[15px] font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
          >
            Log in
          </Link>
          <Link href="/signup" className={buttonClasses("primary", "cta", "group")}>
            Start free trial
            <ArrowRight className="h-4 w-4 transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5" strokeWidth={2.25} aria-hidden />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="-mr-2 flex h-12 w-12 items-center justify-center rounded-md text-ink hover:bg-surface-muted md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? <X className="h-6 w-6" strokeWidth={2} /> : <Menu className="h-6 w-6" strokeWidth={2} />}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-line bg-canvas md:hidden">
          <nav aria-label="Main" className={`${CONTAINER} flex flex-col pb-6 pt-2`}>
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === l.href ? "page" : undefined}
                className="flex min-h-14 items-center border-b border-line font-display text-lg font-semibold text-ink"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <Link href="/login" onClick={() => setOpen(false)} className={buttonClasses("outline", "lg")}>
                Log in
              </Link>
              <Link href="/signup" onClick={() => setOpen(false)} className={buttonClasses("primary", "lg")}>
                Start free trial
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
