"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/app/components/button";
import { Field, fieldClasses } from "@/app/components/input";
import { completeAccountSetup, type AccountSetupState } from "../actions";

/**
 * Finishes setting up an account that has a login but no company row.
 *
 * Replaces the previous dead end on this screen ("sign out and sign up
 * again" — which fails with "already registered", because the login does
 * exist). An account lands here when signup created the auth user but the
 * company insert never happened: email confirmation switched on (signUp
 * returns no session, so the browser-side insert is refused by RLS), a
 * transient failure on that insert, or an older account from before this
 * form existed. Whichever way it happened, the fix is the same one-field
 * form, and it works for every account that's already stuck today.
 */
export function AccountSetupForm({ defaultName }: { defaultName: string | null }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<AccountSetupState | null, FormData>(
    completeAccountSetup,
    null,
  );

  useEffect(() => {
    // The gate above this re-checks for a company on every render, so a
    // refresh is all it takes to fall through into the real dashboard.
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  return (
    <form action={action} className="mt-6 space-y-4 text-left">
      <Field
        label="Company name"
        htmlFor="company-name"
        error={state && !state.ok ? state.error : undefined}
      >
        <input
          id="company-name"
          name="name"
          type="text"
          autoComplete="organization"
          required
          maxLength={120}
          defaultValue={defaultName ?? ""}
          className={fieldClasses(Boolean(state && !state.ok))}
        />
      </Field>
      <Button type="submit" pending={pending} fullWidth>
        {pending ? "Finishing setup…" : "Finish setup"}
      </Button>
    </form>
  );
}
