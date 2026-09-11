"use client";

import { useActionState, useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";

import { Button } from "@/app/components/button";
import { Input } from "@/app/components/input";
import type { Company } from "@/lib/types";
import { updateCompanyProfile, type CompanyProfileState } from "../actions";

export function CompanyProfileForm({ company }: { company: Company }) {
  const [state, formAction, pending] = useActionState<
    CompanyProfileState | null,
    FormData
  >(updateCompanyProfile, null);

  // Show a transient "Saved" note, derived from the action result rather than
  // set from inside an effect.
  const [dismissed, setDismissed] = useState<CompanyProfileState | null>(null);
  const saved = state?.ok === true && state !== dismissed;

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setDismissed(state), 3000);
    return () => clearTimeout(t);
  }, [saved, state]);

  return (
    <form action={formAction} className="space-y-4 rounded-card border border-line bg-surface shadow-sm p-6">
      <Input
        id="name"
        name="name"
        type="text"
        required
        maxLength={120}
        defaultValue={company.name}
        label="Company name"
        error={state?.fieldErrors?.name}
      />

      <Input
        id="address"
        name="address"
        type="text"
        maxLength={250}
        defaultValue={company.address ?? ""}
        label={
          <>
            Address{" "}
            <span className="font-normal text-ink-subtle">(optional)</span>
          </>
        }
        error={state?.fieldErrors?.address}
      />

      <Input
        id="phone"
        name="phone"
        type="tel"
        maxLength={40}
        defaultValue={company.phone ?? ""}
        label={
          <>
            Phone{" "}
            <span className="font-normal text-ink-subtle">(optional)</span>
          </>
        }
        error={state?.fieldErrors?.phone}
      />

      {state?.error && (
        <p className="rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" pending={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-approved">
            <CircleCheck className="h-4 w-4" strokeWidth={2} aria-hidden />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
