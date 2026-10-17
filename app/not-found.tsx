import { ArrowRight } from "lucide-react";

/*
  Plain text wordmark (not <Logo>) and plain anchors (not next/link): the
  root not-found sits in every page's tree, so next/image's or next/link's
  client runtime here would be added to every route's JavaScript. A full page
  load out of a 404 is fine.

  No `metadata` export here on purpose: Next adds noindex to 404 responses on
  its own, and a metadata export from the root not-found has broken the
  Turbopack font pipeline in this Next version.
*/
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 py-6 sm:px-8 sm:py-8">
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- plain anchor on purpose, see the note above */}
      <a href="/" aria-label="Subbies home" className="w-fit rounded-sm">
        <span className="font-display text-lg font-bold tracking-[-0.02em] stretch-wide">
          Subbies
        </span>
      </a>
      <div className="flex flex-1 flex-col justify-center py-16">
        <p className="figure text-7xl text-line-strong sm:text-8xl">404</p>
        <h1 className="mt-6 text-3xl sm:text-5xl">This page isn&apos;t on the register.</h1>
        <p className="mt-4 max-w-lg text-base text-ink-muted">
          The address may be mistyped, or the page has moved. If you followed an
          upload link from an email, use the most recent email you received.
        </p>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-6 text-sm font-semibold">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- see the note above */}
          <a href="/" className="inline-flex items-center gap-1.5 text-brand hover:underline">
            Home <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </a>
          <a href="/dashboard" className="inline-flex items-center gap-1.5 text-brand hover:underline">
            Dashboard <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </a>
          <a href="/contact" className="inline-flex items-center gap-1.5 text-brand hover:underline">
            Contact <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </a>
        </div>
      </div>
    </main>
  );
}
