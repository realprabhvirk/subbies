"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { RotateCw } from "lucide-react";

import { Button } from "@/app/components/button";

/**
 * Branded fallback for an unexpected runtime error in any route segment.
 * Says what happened in plain words and offers the two things that help:
 * try again, or go somewhere known. Production errors from Server
 * Components carry only a digest (no message), shown so support can match
 * it to the server logs.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
      <p className="label-caps text-expired">Something went wrong</p>
      <h1 className="mt-4 text-3xl sm:text-4xl">That didn&apos;t load properly.</h1>
      <p className="mt-4 max-w-lg text-base text-ink-muted">
        It&apos;s usually temporary. Try again, and if it keeps happening, let us
        know what you were doing.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => retry()}>
          <RotateCw className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          Try again
        </Button>
        <Link
          href="/contact"
          className="inline-flex h-11 items-center px-2 text-sm font-semibold text-brand hover:underline"
        >
          Contact support
        </Link>
      </div>
      {error.digest && (
        <p className="mt-8 border-t border-line pt-4 font-mono text-2xs text-ink-muted">
          Reference: {error.digest}
        </p>
      )}
    </main>
  );
}
