"use client";

import { useActionState } from "react";
import { CircleCheck } from "lucide-react";

import { Spinner } from "@/app/components/spinner";
import { submitContact, type ContactState } from "./actions";

const inputClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export function ContactForm() {
  const [state, formAction, pending] = useActionState<
    ContactState | null,
    FormData
  >(submitContact, null);

  if (state?.ok) {
    return (
      <div className="rounded-card border border-approved-line bg-approved-bg p-6 text-sm text-approved">
        <CircleCheck className="h-5 w-5" strokeWidth={2} aria-hidden />
        <p className="mt-2 font-medium">Message sent</p>
        <p className="mt-1 text-approved/90">
          Thanks — we&apos;ll get back to you at the email you gave us.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-card border border-line bg-surface shadow-sm p-6"
    >
      {/* Honeypot */}
      <div aria-hidden className="hidden">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input id="name" name="name" type="text" required maxLength={120} className={inputClass} />
        {state?.fieldErrors?.name && (
          <p className="text-sm text-expired">{state.fieldErrors.name}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input id="email" name="email" type="email" required className={inputClass} />
        {state?.fieldErrors?.email && (
          <p className="text-sm text-expired">{state.fieldErrors.email}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="message" className="block text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          maxLength={4000}
          className={inputClass}
        />
        {state?.fieldErrors?.message && (
          <p className="text-sm text-expired">{state.fieldErrors.message}</p>
        )}
      </div>

      {state?.error && (
        <p className="rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {pending && <Spinner className="h-4 w-4" />}
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
