"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/app/components/logo";
import { Spinner } from "@/app/components/spinner";
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

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
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
        <Logo className="mb-8" />
        <div className="rounded-card border border-line bg-surface shadow-sm p-6 shadow-sm sm:p-8">
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
                className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
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
                className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
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

            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
            >
              {pending && <Spinner className="h-4 w-4" />}
              {pending ? "Creating account…" : "Create account"}
            </button>
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
