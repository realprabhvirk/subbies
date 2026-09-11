"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { Logo } from "@/app/components/logo";
import { Spinner } from "@/app/components/spinner";
import { PasswordField } from "@/app/components/password-field";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // One-time read of the URL flags set by the password-reset redirect and
    // by the account-deletion flow.
    const params = new URLSearchParams(window.location.search);
    if (params.has("reset")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResetDone(true);
    }
    if (params.has("deleted")) {
      setAccountDeleted(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const supabase = createClient();
      // The account was created under its normalized email (see signup), so
      // someone typing the +tag variant they originally used has to be
      // normalized the same way here or it just won't match.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });

      if (signInError) {
        setError(
          signInError.message === "Invalid login credentials"
            ? "That email and password don't match an account."
            : signInError.message,
        );
        return;
      }

      const redirectTo =
        new URLSearchParams(window.location.search).get("redirectTo") ||
        "/dashboard";
      router.replace(redirectTo);
      router.refresh();
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-8" />
        <div className="rounded-card border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold">Log in</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Access your contractor and compliance records.
          </p>

          {resetDone && (
            <p className="mt-4 rounded-md bg-approved-bg px-3 py-2 text-sm text-approved">
              Your password has been updated. Log in with your new password.
            </p>
          )}

          {accountDeleted && (
            <p className="mt-4 rounded-md bg-surface-muted px-3 py-2 text-sm text-ink-muted">
              Your account and all its data have been permanently deleted.
            </p>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
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

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <PasswordField
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {pending ? "Logging in…" : "Log in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Need an account?{" "}
          <Link href="/signup" className="font-medium text-brand hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
