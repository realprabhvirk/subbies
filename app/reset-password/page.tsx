"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/app/components/logo";
import { Spinner } from "@/app/components/spinner";
import { PasswordField } from "@/app/components/password-field";

type Phase = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    let settled = false;

    const settle = (next: Phase) => {
      if (!settled) {
        settled = true;
        setPhase(next);
      }
    };

    // The SSR browser client processes the ?code= in the URL on load and
    // establishes a temporary recovery session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) settle("ready");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) settle("ready");
    });

    const timer = setTimeout(() => settle("invalid"), 4000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      await supabase.auth.signOut();
      router.replace("/login?reset=1");
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-8" />
        <div className="rounded-card border border-line bg-surface p-6 shadow-sm sm:p-8">
          {phase === "checking" && (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <Spinner className="h-4 w-4" />
              Checking your reset link…
            </div>
          )}

          {phase === "invalid" && (
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">This link isn&apos;t valid</h1>
              <p className="text-sm text-ink-muted">
                The reset link may have expired, already been used, or been opened
                in a different browser than the one you requested it from.
              </p>
              <p className="pt-2 text-sm">
                <Link
                  href="/forgot-password"
                  className="font-medium text-brand hover:underline"
                >
                  Request a new link
                </Link>
              </p>
            </div>
          )}

          {phase === "ready" && (
            <>
              <h1 className="text-xl font-semibold">Set a new password</h1>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-sm font-medium">
                    New password
                  </label>
                  <PasswordField
                    id="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="confirm" className="block text-sm font-medium">
                    Confirm new password
                  </label>
                  <PasswordField
                    id="confirm"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
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
                  {pending ? "Saving…" : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
