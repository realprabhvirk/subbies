"use client";

import { useState, useTransition } from "react";
import { CircleCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/app/components/spinner";
import { PasswordField } from "@/app/components/password-field";

export function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    startTransition(async () => {
      const { error: updateError } = await createClient().auth.updateUser({
        password,
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setPassword("");
      setConfirm("");
      setDone(true);
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-card border border-line bg-surface shadow-sm p-6"
    >
      <div>
        <h3 className="text-sm font-semibold">Change password</h3>
        <p className="mt-0.5 text-sm text-ink-muted">
          You&apos;ll stay signed in on this device.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="new-password" className="block text-sm font-medium">
          New password
        </label>
        <PasswordField
          id="new-password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm-password" className="block text-sm font-medium">
          Confirm new password
        </label>
        <PasswordField
          id="confirm-password"
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

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {pending && <Spinner className="h-4 w-4" />}
          {pending ? "Updating…" : "Update password"}
        </button>
        {done && (
          <span className="inline-flex items-center gap-1.5 text-sm text-approved">
            <CircleCheck className="h-4 w-4" strokeWidth={2} aria-hidden />
            Password updated
          </span>
        )}
      </div>
    </form>
  );
}
