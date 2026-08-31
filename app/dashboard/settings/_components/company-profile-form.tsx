"use client";

import { useActionState, useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";

import { Spinner } from "@/app/components/spinner";
import type { Company } from "@/lib/types";
import { updateCompanyProfile, type CompanyProfileState } from "../actions";

const inputClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

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
      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-sm font-medium">
          Company name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={120}
          defaultValue={company.name}
          className={inputClass}
        />
        {state?.fieldErrors?.name && (
          <p className="text-sm text-expired">{state.fieldErrors.name}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="address" className="block text-sm font-medium">
          Address <span className="font-normal text-ink-subtle">(optional)</span>
        </label>
        <input
          id="address"
          name="address"
          type="text"
          maxLength={250}
          defaultValue={company.address ?? ""}
          className={inputClass}
        />
        {state?.fieldErrors?.address && (
          <p className="text-sm text-expired">{state.fieldErrors.address}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="phone" className="block text-sm font-medium">
          Phone <span className="font-normal text-ink-subtle">(optional)</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          maxLength={40}
          defaultValue={company.phone ?? ""}
          className={inputClass}
        />
        {state?.fieldErrors?.phone && (
          <p className="text-sm text-expired">{state.fieldErrors.phone}</p>
        )}
      </div>

      {state?.error && (
        <p className="rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {pending && <Spinner className="h-4 w-4" />}
          {pending ? "Saving…" : "Save changes"}
        </button>
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
