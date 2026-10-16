"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { safeRedirectPath } from "@/lib/auth/redirect-path";
import { AuthHeading } from "@/app/components/auth-heading";
import { Alert } from "@/app/components/alert";
import { Button } from "@/app/components/button";
import { Field, fieldClasses } from "@/app/components/input";
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
    if (params.get("confirm") === "failed") {
      setError(
        "That confirmation link didn't work. It may have expired or already been used. Log in to continue, or sign up again.",
      );
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
        const msg = signInError.message;
        setError(
          msg === "Invalid login credentials"
            ? "That email and password don't match an account."
            : /email not confirmed/i.test(msg)
              ? "Please confirm your email first. Open the link we sent you. Need another? Sign up again with the same details to resend it."
              : msg,
        );
        return;
      }

      // Only the middleware ever writes ?redirectTo=, and it writes a
      // pathname — but the value arrives via the URL, so anyone can put
      // anything in it. Restricted to a same-origin path so a crafted login
      // link can't hand the freshly signed-in user to another site.
      const redirectTo = safeRedirectPath(
        new URLSearchParams(window.location.search).get("redirectTo"),
      );
      router.replace(redirectTo);
      router.refresh();
    });
  };

  return (
    <>
        <div>
          <AuthHeading
            title="Log in"
            description="Access your contractor and compliance records."
          />

          {resetDone && (
            <Alert tone="success" className="mb-6">
              Your password has been updated. Log in with your new password.
            </Alert>
          )}

          {accountDeleted && (
            <Alert tone="info" className="mb-6">
              Your account and all its data have been permanently deleted.
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClasses()}
              />
            </Field>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-semibold">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-brand hover:underline"
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
              <p className="rounded-md border border-expired-line bg-expired-bg/70 px-3 py-2 text-sm text-expired">
                {error}
              </p>
            )}

            <Button type="submit" pending={pending} fullWidth>
              {pending ? "Logging in…" : "Log in"}
            </Button>
          </form>
        </div>

        <p className="mt-8 border-t border-line pt-6 text-sm text-ink-muted">
          Need an account?{" "}
          <Link href="/signup" className="font-semibold text-brand hover:underline">
            Create one
          </Link>
        </p>
    </>
  );
}
