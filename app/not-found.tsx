import { Logo } from "@/app/components/logo";
import { ButtonLink } from "@/app/components/button";

/**
 * The site-wide 404, in the same shell as the other standalone pages (login,
 * the contractor's invalid-link page). Upload links have their own not-found
 * with contractor-specific wording; this covers everything else. Next adds
 * <meta name="robots" content="noindex"> to 404 responses itself, so no
 * metadata export is needed here.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-4 py-12 text-center">
      <Logo className="mb-8" />
      <p className="font-mono text-sm text-ink-subtle">404</p>
      <h1 className="mt-2 text-2xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-sm text-ink-muted">
        The link may be out of date, or the page may have moved. If you were
        sent here from an email about documents, open the most recent one.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">Go to the homepage</ButtonLink>
        <ButtonLink href="/dashboard" variant="secondary">
          Open your dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
