"use client"; // Error boundaries must be Client Components

/**
 * Branded fallback for an unexpected runtime error in any route segment.
 * Says what happened in plain words and offers the two things that help:
 * try again, or go somewhere known. Production errors from Server
 * Components carry only a digest (no message), shown so support can match
 * it to the server logs.
 *
 * Deliberately dependency-light (no Button component, no icon library): a
 * root error boundary ships with every page, so anything imported here is
 * paid for on every route. buttonClasses is a plain string helper.
 */
import { buttonClasses } from "@/app/components/button-styles";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[80svh] w-full max-w-3xl flex-col justify-center px-5 py-16 sm:px-8">
      <p className="label-caps text-expired">Something went wrong</p>
      <h1 className="mt-4 text-[2.375rem] leading-[1.04] tracking-display sm:text-5xl">That didn&apos;t load properly.</h1>
      <p className="mt-5 max-w-lg text-lg text-ink-muted">
        It&apos;s usually temporary. Try again.
      </p>
      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => retry()}
          className={buttonClasses("primary", "lg")}
        >
          Try again
        </button>
        {/* A plain anchor (full page load) on purpose: after an error a
            fresh load is the safer way out, and it keeps next/link's client
            runtime out of this every-page boundary. */}
        <a
          href="/contact"
          className={buttonClasses("outline", "lg")}
        >
          Contact support
        </a>
      </div>
      {error.digest && (
        <p className="mt-8 border-t border-line pt-4 font-mono text-2xs text-ink-muted">
          Reference: {error.digest}
        </p>
      )}
    </main>
  );
}
