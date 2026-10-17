"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { Logo } from "@/app/components/logo";
import { buttonClasses } from "@/app/components/button-styles";

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Subbies home" className="rounded-sm">
          <Logo height={26} />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                  active ? "text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {l.label}
                {active && (
                  <span aria-hidden className="absolute inset-x-3 -bottom-[13px] h-0.5 bg-ink" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-1 md:flex">
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Log in
          </Link>
          <Link href="/signup" className={buttonClasses("primary", "sm")}>
            Start free trial
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? (
            <X className="h-5 w-5" strokeWidth={2} />
          ) : (
            <Menu className="h-5 w-5" strokeWidth={2} />
          )}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-canvas px-4 pb-5 pt-2 md:hidden">
          <nav aria-label="Main" className="flex flex-col">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === l.href ? "page" : undefined}
                className="flex min-h-12 items-center border-b border-line font-display text-lg font-semibold text-ink"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link href="/login" className={buttonClasses("secondary", "md")}>
                Log in
              </Link>
              <Link href="/signup" className={buttonClasses("primary", "md")}>
                Start free trial
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
