"use client";

import { useState, useTransition } from "react";
import { CircleCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/app/components/button";
import { Field } from "@/app/components/input";
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

      <Field label="New password" htmlFor="new-password">
        <PasswordField
          id="new-password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirm-password">
        <PasswordField
          id="confirm-password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>

      {error && (
        <p className="rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" pending={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
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
