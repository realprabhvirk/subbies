"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { normalizeEmail } from "@/lib/auth/normalize-email";
import { Logo } from "@/app/components/logo";
import { Button } from "@/app/components/button";
import { fieldClasses } from "@/app/components/input";
import { PasswordField } from "@/app/components/password-field";

export default function SignupPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (authError) {
        setError(
          authError.message === "User already registered"
            ? "An account with this email already exists. Try logging in instead."
            : authError.message,
        );
        return;
      }

      // Supabase's anti-enumeration behavior for an already-registered email:
      // rather than an explicit error, it can return a 200 with a user object
      // whose identities array is empty and no session. Treat that the same
      // as the explicit error above instead of silently proceeding to create
      // a company row against a session that doesn't exist.
      if (authData.user && authData.user.identities?.length === 0) {
        setError("An account with this email already exists. Try logging in instead.");
        return;
      }

      if (authData.user) {
        const { error: companyError } = await supabase
          .from("companies")
          .insert({ user_id: authData.user.id, name: companyName.trim() });

        if (companyError) {
          setError(
            "Your login was created but we couldn't set up your company. Please contact support.",
          );
          return;
        }
      }

      router.replace("/onboarding");
      router.refresh();
    });
  };

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

            <p className="text-xs text-ink-muted">
              By creating an account, you agree to our{" "}
              <Link href="/privacy" className="font-medium text-brand hover:underline">
                Privacy Policy
              </Link>
              . If you delete your account, your email is retained to prevent
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
