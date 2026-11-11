"use client";

import { useActionState } from "react";
import { CircleCheck } from "lucide-react";

import { Spinner } from "@/app/components/spinner";
import { buttonClasses } from "@/app/components/button-styles";
import { fieldClasses } from "@/app/components/input";
import { submitContact, type ContactState } from "./actions";

// The shared field treatment, so these forms can't drift from the rest.
const inputClass = fieldClasses(false, "", "lg");

export function ContactForm() {
  const [state, formAction, pending] = useActionState<
    ContactState | null,
    FormData
  >(submitContact, null);

  if (state?.ok) {
    return (
      <div className="rounded-card border border-approved-line bg-approved-bg/60 p-8 text-base text-approved">
        <CircleCheck className="h-6 w-6" strokeWidth={2} aria-hidden />
        <p className="mt-3 font-display text-lg font-semibold">Message sent</p>
        <p className="mt-1 text-approved/90">
          Thanks. We&apos;ll get back to you at the email you gave us.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-card border border-line bg-surface p-6 shadow-sm sm:p-10"
    >
      {/* Honeypot */}
      <div aria-hidden className="hidden">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="space-y-2">
        <label htmlFor="name" className="block text-base font-semibold">
          Name
        </label>
        <input id="name" name="name" type="text" required maxLength={120} className={inputClass} />
        {state?.fieldErrors?.name && (
          <p className="text-sm text-expired">{state.fieldErrors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="block text-base font-semibold">
          Email
        </label>
        <input id="email" name="email" type="email" required className={inputClass} />
        {state?.fieldErrors?.email && (
          <p className="text-sm text-expired">{state.fieldErrors.email}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="message" className="block text-base font-semibold">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          maxLength={4000}
          className={inputClass}
        />
        {state?.fieldErrors?.message && (
          <p className="text-sm text-expired">{state.fieldErrors.message}</p>
        )}
      </div>

      {state?.error && (
        <p className="rounded-md border border-expired-line bg-expired-bg/70 px-3 py-2 text-sm text-expired">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("primary", "lg", "w-full sm:w-auto")}
      >
        {pending && <Spinner className="h-4 w-4" />}
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
