import { ArrowRight } from "lucide-react";

import { buttonClasses } from "@/app/components/button-styles";

/*
  Plain <img> logo and plain anchors (not next/image or next/link): the root
  not-found sits in every page's tree, so their client runtime here would be
  added to every route's JavaScript. A full page load out of a 404 is fine.
  buttonClasses is a plain string helper, no runtime.

  No `metadata` export here on purpose: Next adds noindex to 404 responses on
  its own, and a metadata export from the root not-found has broken the
  Turbopack font pipeline in this Next version.
*/
export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-svh flex-col overflow-hidden px-5 py-6 sm:px-8 lg:px-14">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0, transparent 39px, var(--color-line) 39px, var(--color-line) 40px)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- plain anchor on purpose, see the note above */}
      <a href="/" aria-label="Subbies home" className="flex w-fit items-center gap-2.5 rounded-md">
        {/* eslint-disable-next-line @next/next/no-img-element -- see the note above */}
        <img src="/brand/subbies-icon.png" alt="" width={36} height={36} className="h-8 w-8 sm:h-9 sm:w-9" />
        <span className="font-display text-xl font-semibold tracking-[-0.02em] stretch-wide sm:text-[22px]">Subbies</span>
      </a>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-16">
        <p className="rise figure text-8xl text-line-strong sm:text-9xl">404</p>
        <h1 className="rise mt-6 text-[2.375rem] leading-[1.04] tracking-display [--anim-delay:100ms] sm:text-5xl">
          This page isn&apos;t on the register.
        </h1>
        <p className="rise mt-5 max-w-lg text-lg text-ink-muted [--anim-delay:180ms]">
          Followed an upload link? Use the most recent email you received.
        </p>
        <div className="rise mt-9 flex flex-col gap-3 [--anim-delay:260ms] sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see the note above */}
          <a href="/" className={buttonClasses("primary", "lg", "group")}>
            Go home
            <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </a>
          <a href="/contact" className={buttonClasses("outline", "lg")}>
            Contact us
          </a>
        </div>
      </div>
    </main>
  );
}
