"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/app/components/button";
import {
  requestAccountDeletionCode,
  verifyAccountDeletionCode,
  confirmAccountDeletion,
} from "../deletion-actions";

type Step = "warning" | "code" | "consent";

export function DeleteAccountSection() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("warning");
  const [code, setCode] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
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
      const result = await verifyAccountDeletionCode(code);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setStep("consent");
    });
  };

  const finalizeDeletion = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmAccountDeletion(code, consentChecked);
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

  const resetAll = () => {
    setStep("warning");
    setCode("");
    setConsentChecked(false);
    setError(null);
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
        <Button
          type="button"
          variant="danger-outline"
          onClick={sendCode}
          pending={pending}
          className="mt-4"
        >
          Delete my account
        </Button>
      )}

      {step === "code" && (
        <form onSubmit={submitCode} className="mt-4 space-y-3">
          <p className="text-sm text-ink-muted">
            We sent a 6-digit code to your account email. Enter it below to
            continue. It expires in 10 minutes.
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
            <Button
              type="submit"
              variant="danger"
              disabled={code.length !== 6}
              pending={pending}
            >
              Verify code
            </Button>
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
              onClick={resetAll}
              disabled={pending}
              className="text-sm text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {step === "consent" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-md border border-expired-line bg-expired-bg p-4">
            <p className="text-sm font-medium text-expired">
              This will permanently delete your account, all subcontractor
              records, all uploaded documents, and cancel your billing
              immediately. This cannot be undone.
            </p>
          </div>

          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-strong text-expired focus:ring-expired"
            />
            <span>
              I understand my data and billing will be permanently deleted,
              and that my email address will be retained solely to prevent
              duplicate free trial signups.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="danger"
              onClick={finalizeDeletion}
              disabled={!consentChecked}
              pending={pending}
            >
              Delete My Account
            </Button>
            <button
              type="button"
              onClick={resetAll}
              disabled={pending}
              className="text-sm text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">{error}</p>
      )}
    </div>
  );
}
