"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/app/components/logo";
import { Spinner } from "@/app/components/spinner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/reset-password` },
      );
      // Don't reveal whether the address has an account.
      if (resetError && resetError.status !== 400) {
        setError("Something went wrong. Try again in a moment.");
        return;
      }
      setSent(true);
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-8" />
        <div className="rounded-card border border-line bg-surface p-6 shadow-sm sm:p-8">
          {sent ? (
            <div className="space-y-2">
              <CircleCheck className="h-6 w-6 text-approved" strokeWidth={2} aria-hidden />
              <h1 className="text-xl font-semibold">Check your email</h1>
              <p className="text-sm text-ink-muted">
                If an account exists for <span className="font-medium">{email}</span>,
                we&apos;ve sent a link to reset your password. It expires after a
                short while.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Reset your password</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Enter your account email and we&apos;ll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                </div>

                {error && (
                  <p className="rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
                >
                  {pending && <Spinner className="h-4 w-4" />}
                  {pending ? "Sending…" : "Send reset link"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          <Link href="/login" className="font-medium text-brand hover:underline">
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}
