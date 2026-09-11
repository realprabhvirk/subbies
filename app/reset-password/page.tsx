"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/app/components/logo";
import { Button } from "@/app/components/button";
import { Spinner } from "@/app/components/spinner";
import { PasswordField } from "@/app/components/password-field";

type Phase = "checking" | "ready" | "invalid" | "done";

/** How long to wait for the recovery session before giving up on a link that carries auth params. */
const EXCHANGE_TIMEOUT_MS = 20_000;

/**
 * Supabase returns recovery failures in the URL rather than in a response
 * body, and depending on the flow they land in the query string or the hash.
 */
function readUrlAuthState(): {
  hasAuthParams: boolean;
  errorMessage: string | null;
} {
  if (typeof window === "undefined") {
    return { hasAuthParams: false, errorMessage: null };
  }

  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const read = (key: string) => url.searchParams.get(key) ?? hashParams.get(key);

  const errorCode = read("error_code");
  const rawError = read("error");
  const description = read("error_description");

  let errorMessage: string | null = null;
  if (errorCode === "otp_expired") {
    errorMessage =
      "This reset link has expired. Links are only valid for a short time after they're sent.";
  } else if (errorCode || rawError) {
    errorMessage = description
      ? decodeURIComponent(description.replace(/\+/g, " "))
      : "This reset link is no longer valid.";
  }

  // PKCE sends ?code=, the implicit flow sends #access_token=, and some
  // templates send a token_hash. Any of them means a link was actually followed.
  const hasAuthParams = Boolean(
    read("code") || read("access_token") || read("token_hash"),
  );

  return { hasAuthParams, errorMessage };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [invalidReason, setInvalidReason] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const { hasAuthParams, errorMessage } = readUrlAuthState();

    // The URL can only be read after hydration, so these first-paint decisions
    // have to happen here rather than during render — same one-time-URL-read
    // pattern as the login page. Starting from "checking" on both server and
    // client keeps the markup identical through hydration.

    // Supabase told us outright that the link failed — say so immediately
    // rather than making the user wait out a timeout for a vaguer message.
    if (errorMessage) {
      // The URL is only readable after hydration; deriving this during render
      // would make the server and client markup disagree on a real reset link.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInvalidReason(errorMessage);
      setPhase("invalid");
      return;
    }

    // Someone opened /reset-password directly, with no link behind it.
    if (!hasAuthParams) {
      setInvalidReason(
        "Open the reset link from the email we sent you to set a new password.",
      );
      setPhase("invalid");
      return;
    }

    let settled = false;

    const settle = (next: Phase, reason?: string) => {
      if (settled) return;
      settled = true;
      if (reason) setInvalidReason(reason);
      setPhase(next);
    };

    const onRecovered = () => {
      // Don't leave the recovery token sitting in the address bar, history or
      // any outbound referrer once it has been exchanged for a session.
      window.history.replaceState({}, "", window.location.pathname);
      settle("ready");
    };

    const failUnreachable = () =>
      settle(
        "invalid",
        "We couldn't reach the server to verify this link. Check your connection and request a new link.",
      );

    // Every step below can throw or reject if Supabase is unreachable mid
    // exchange. Unhandled, that takes the whole page down to an error screen
    // instead of the recoverable "request a new link" state this page exists
    // to show, so all of it is guarded.
    let unsubscribe = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const supabase = createClient();

      // Fires INITIAL_SESSION on subscribe, so a session that already exists
      // by this point is caught too — no race with the client's URL handling.
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" || session) onRecovered();
      });
      unsubscribe = () => sub.subscription.unsubscribe();

      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (data.session) onRecovered();
        })
        .catch(failUnreachable);

      // The link carried a token but no session ever materialised — usually
      // the code was already used, or it's being opened in a different browser
      // than the one that requested it (PKCE keeps its verifier client-side).
      timer = setTimeout(
        () =>
          settle(
            "invalid",
            "We couldn't verify this reset link. It may have already been used, or been opened in a different browser than the one you requested it from.",
          ),
        EXCHANGE_TIMEOUT_MS,
      );
    } catch {
      failUnreachable();
    }

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
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

      // Confirm it worked before navigating, then sign the recovery session
      // out so the new password is what actually gets used to log back in.
      setPhase("done");
      await supabase.auth.signOut();
      setTimeout(() => router.replace("/login?reset=1"), 1200);
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo className="mb-8" height={32} showTagline priority />
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
                {invalidReason ??
                  "The reset link may have expired, already been used, or been opened in a different browser than the one you requested it from."}
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

          {phase === "done" && (
            <div className="space-y-2">
              <CircleCheck
                className="h-6 w-6 text-approved"
                strokeWidth={2}
                aria-hidden
              />
              <h1 className="text-xl font-semibold">Password updated</h1>
              <p className="text-sm text-ink-muted">
                Taking you to the login page so you can sign in with your new
                password.
              </p>
            </div>
          )}

          {phase === "ready" && (
            <>
              <h1 className="text-xl font-semibold">Set a new password</h1>
              <p className="mt-1 text-sm text-ink-muted">
                Choose something you haven&apos;t used before. At least 8
                characters.
              </p>
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

                <Button type="submit" pending={pending} fullWidth>
                  {pending ? "Saving…" : "Update password"}
                </Button>
              </form>
            </>
          )}
        </div>

        {(phase === "checking" || phase === "ready") && (
          <p className="mt-6 text-center text-sm text-ink-muted">
            <Link href="/login" className="font-medium text-brand hover:underline">
              Back to log in
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
