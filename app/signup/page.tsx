"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { classifySignupResult } from "@/lib/auth/signup-logic";
import { TERMS_VERSION } from "@/lib/legal/terms";
import { Logo } from "@/app/components/logo";
import { Button } from "@/app/components/button";
import { fieldClasses } from "@/app/components/input";
import { PasswordField } from "@/app/components/password-field";

export default function SignupPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // The `required` attribute on the checkbox covers normal use; this covers
    // anything that skips native form validation.
    if (!agreed) {
      setError("Please confirm you're 18 or over and agree to the Terms and Privacy Policy.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();

      // Normalized *before* it ever reaches Supabase — auth.users.email is the
      // only place this app stores an account's email at all (companies has
      // no email column of its own), so this is the one point that actually
      // decides whether prabh+1@gmail.com and prabh+work@gmail.com collide.
      // Signing both up with the same normalized string means Supabase's own
      // unique constraint on auth.users.email is what blocks the second one —
      // a real database-level guarantee, not just an app-layer check.
      const normalizedEmail = normalizeEmail(email);
      const trimmedCompanyName = companyName.trim();

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        // Carried in the user's own metadata so it survives to the first
        // authenticated visit. That's what lets the dashboard finish setup
        // if the company row can't be created right here — see
        // lib/auth/signup-logic.ts for why that can happen.
        //
        // The terms fields record what was agreed at signup. terms_accepted_at
        // is set by the browser, so treat auth.users.created_at (set by the
        // server) as the trustworthy signup time and terms_version as the
        // record of which wording they were shown.
        options: {
          data: {
            company_name: trimmedCompanyName,
            age_confirmed: true,
            terms_version: TERMS_VERSION,
            terms_accepted_at: new Date().toISOString(),
          },
        },
      });

      if (authError) {
        setError(
          authError.message === "User already registered"
            ? "An account with this email already exists. Try logging in instead."
            : authError.message,
        );
        return;
      }

      const outcome = classifySignupResult({
        user: authData.user,
        session: authData.session,
      });

      if (outcome === "already_registered") {
        setError("An account with this email already exists. Try logging in instead.");
        return;
      }
      if (outcome === "no_user") {
        setError("Something went wrong creating your account. Try again.");
        return;
      }
      if (outcome === "confirmation_pending") {
        // Email confirmation is on: there's no session yet, so nothing more
        // can be created from here. The company row gets created on their
        // first signed-in visit instead (dashboard-gate → AccountSetupForm).
        setConfirmationSentTo(normalizedEmail);
        return;
      }

      // session_ready: confirmation is off, create the company now so the
      // account is complete before they land on onboarding. If this insert
      // fails it's logged and NOT treated as fatal — the dashboard's setup
      // screen finishes it, instead of the old "contact support" dead end.
      const { error: companyError } = await supabase
        .from("companies")
        .insert({ user_id: authData.user!.id, name: trimmedCompanyName });
      if (companyError) {
        console.error("signup: company insert failed, deferring to account setup", companyError);
      }

      router.replace("/onboarding");
      router.refresh();
    });
  };

  if (confirmationSentTo) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Logo className="mb-8" height={32} showTagline priority />
          <div className="rounded-card border border-line bg-surface p-6 shadow-sm sm:p-8">
            <h1 className="text-xl font-semibold">Check your email</h1>
            <p className="mt-2 text-sm text-ink-muted">
              We sent a confirmation link to{" "}
              <span className="font-medium text-ink">{confirmationSentTo}</span>.
              Click it, then log in to finish setting up{" "}
              <span className="font-medium text-ink">{companyName.trim()}</span>.
            </p>
          </div>
          <p className="mt-6 text-center text-sm text-ink-muted">
            <Link href="/login" className="font-medium text-brand hover:underline">
              Go to log in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-8" height={32} showTagline priority />
        <div className="rounded-card border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Start collecting contractor documents in a few minutes.
          </p>

          <form onSubmit={handleSignup} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="company" className="block text-sm font-medium">
                Company name
              </label>
              <input
                id="company"
                type="text"
                autoComplete="organization"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={fieldClasses()}
              />
            </div>

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
                className={fieldClasses()}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <PasswordField
                id="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-ink-subtle">At least 8 characters.</p>
            </div>

            {error && (
              <p className="rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
                {error}
              </p>
            )}

            <label
              htmlFor="terms"
              className="flex items-start gap-2.5 text-sm text-ink"
            >
              <input
                id="terms"
                type="checkbox"
                required
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong text-brand focus:ring-brand"
              />
              <span>
                I&rsquo;m 18 or over, I&rsquo;m signing up on behalf of a
                business, and I agree to the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="font-medium text-brand hover:underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="font-medium text-brand hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            <p className="text-xs text-ink-muted">
              If you delete your account, your email is retained to prevent
              duplicate free trials.
            </p>

            <Button type="submit" pending={pending} fullWidth>
              {pending ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
