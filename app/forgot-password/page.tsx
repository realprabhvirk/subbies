"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CircleCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/site-url";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { AuthShell, AuthHeading } from "@/app/components/auth-shell";
import { Button } from "@/app/components/button";
import { fieldClasses } from "@/app/components/input";

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
      // getSiteUrl() prefers NEXT_PUBLIC_APP_URL over the current origin, so a
      // reset requested from a preview deployment still lands on the canonical
      // production host. Note this value is only honoured if it is also in the
      // Supabase redirect allowlist — otherwise Supabase silently substitutes
      // the project's Site URL, which is what sends links to localhost.
      //
      // Normalized the same way as signup: the account is stored under its
      // normalized email, so requesting a reset via a +tag variant has to be
      // normalized to find it.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizeEmail(email),
        { redirectTo: `${getSiteUrl()}/reset-password` },
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
    <AuthShell>
        <div>
          {sent ? (
            <div>
              <CircleCheck className="mb-5 h-8 w-8 text-approved" strokeWidth={1.75} aria-hidden />
              <h1 className="text-3xl">Check your email</h1>
              <p className="mt-2 text-sm text-ink-muted">
                If an account exists for <span className="font-medium">{email}</span>,
                we&apos;ve sent a link to reset your password. It expires after a
                short while.
              </p>
            </div>
          ) : (
            <>
              <AuthHeading
                title="Reset your password"
                description="Enter your account email and we'll send you a reset link."
              />

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-semibold">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={fieldClasses()}
                  />
                </div>

                {error && (
                  <p className="rounded-md border border-expired-line bg-expired-bg/70 px-3 py-2 text-sm text-expired">
                    {error}
                  </p>
                )}

                <Button type="submit" pending={pending} fullWidth>
                  {pending ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-8 border-t border-line pt-6 text-sm text-ink-muted">
          <Link href="/login" className="font-semibold text-brand hover:underline">
            Back to log in
          </Link>
        </p>
    </AuthShell>
  );
}
