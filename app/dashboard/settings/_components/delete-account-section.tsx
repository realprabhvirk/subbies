"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/app/components/spinner";
import { requestAccountDeletionCode, confirmAccountDeletion } from "../deletion-actions";

type Step = "warning" | "code";

export function DeleteAccountSection() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("warning");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const sendCode = () => {
    setError(null);
    startTransition(async () => {
      const result = await requestAccountDeletionCode();
      if (!result.ok) {
        setError(result.error ?? "Couldn't send a code. Try again.");
        return;
      }
      setCooldown(60);
      setStep("code");
    });
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await confirmAccountDeletion(code);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      // The DB-side session is already gone — deleting the auth user
      // cascades to it — but this browser's local session cookie still
      // needs clearing so the app doesn't think it's signed in.
      await createClient().auth.signOut();
      router.replace("/login?deleted=1");
    });
  };

  return (
    <div className="rounded-card border border-expired-line bg-surface shadow-sm p-6">
      <div className="flex items-start gap-3">
        <TriangleAlert
          className="mt-0.5 h-5 w-5 shrink-0 text-expired"
          strokeWidth={2}
          aria-hidden
        />
        <div>
          <h3 className="text-sm font-semibold text-expired">Delete account</h3>
          <p className="mt-1 text-sm text-ink-muted">
            This will permanently delete your account and all data — your
            company, contractors, documents, and projects. This cannot be
            undone.
          </p>
        </div>
      </div>

      {step === "warning" && (
        <button
          type="button"
          onClick={sendCode}
          disabled={pending}
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-expired-line px-4 py-2 text-sm font-medium text-expired transition-colors hover:bg-expired-bg disabled:opacity-60"
        >
          {pending && <Spinner className="h-4 w-4" />}
          Delete my account
        </button>
      )}

      {step === "code" && (
        <form onSubmit={submitCode} className="mt-4 space-y-3">
          <p className="text-sm text-ink-muted">
            We sent a 6-digit code to your account email. Enter it below to
            confirm deletion. It expires in 10 minutes.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full max-w-[10rem] rounded-md border border-line-strong bg-surface px-3 py-2 text-center text-lg tracking-[0.3em] outline-none focus:border-brand"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending || code.length !== 6}
              className="inline-flex items-center gap-2 rounded-md bg-expired px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending && <Spinner className="h-4 w-4" />}
              Permanently delete
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={pending || cooldown > 0}
              className="text-sm font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:text-ink-subtle disabled:no-underline"
            >
              {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("warning");
                setCode("");
                setError(null);
              }}
              disabled={pending}
              className="text-sm text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">{error}</p>
      )}
    </div>
  );
}
