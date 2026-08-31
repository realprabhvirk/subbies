"use client";

import { useActionState, useMemo, useState } from "react";
import { Check } from "lucide-react";

import { Spinner } from "@/app/components/spinner";
import type { DocumentType } from "@/lib/types";
import { createContractor, type NewContractorState } from "../../actions";

const STEP_ONE_FIELDS = ["business_name", "contact_name", "email", "phone", "trade"] as const;

function Field({
  id,
  label,
  error,
  children,
  hint,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-subtle">{hint}</p>}
      {error && <p className="text-sm text-expired">{error}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export function NewContractorForm({
  documentTypes,
}: {
  documentTypes: DocumentType[];
}) {
  const [state, formAction, pending] = useActionState<
    NewContractorState | null,
    FormData
  >(createContractor, null);

  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    trade: "",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stepOneError, setStepOneError] = useState<string | null>(null);

  // If the server rejected a step-one field, jump back so the user sees it.
  // Adjust during render (React's "reacting to a prop change") rather than in
  // an effect.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (
      state?.fieldErrors &&
      STEP_ONE_FIELDS.some((f) => state.fieldErrors?.[f])
    ) {
      setStep(1);
    }
  }

  const canContinue = useMemo(
    () => values.business_name.trim() !== "" && values.email.trim() !== "",
    [values],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleContinue = () => {
    if (!canContinue) {
      setStepOneError("Add a business name and email address to continue.");
      return;
    }
    setStepOneError(null);
    setStep(2);
  };

  return (
    <form action={formAction} className="space-y-6">
      {/* Step indicator */}
      <ol className="flex items-center gap-3 text-sm">
        <li className={step === 1 ? "font-medium text-brand-ink" : "text-ink-subtle"}>
          1. Details
        </li>
        <li aria-hidden className="h-px w-8 bg-line-strong" />
        <li className={step === 2 ? "font-medium text-brand-ink" : "text-ink-subtle"}>
          2. Documents
        </li>
      </ol>

      {/* Step 1 — kept mounted so its values submit with the form */}
      <div
        className={`space-y-4 rounded-card border border-line bg-surface shadow-sm p-6 ${
          step === 1 ? "" : "hidden"
        }`}
      >
        <Field id="business_name" label="Business name" error={state?.fieldErrors?.business_name}>
          <input
            id="business_name"
            name="business_name"
            type="text"
            required
            maxLength={120}
            value={values.business_name}
            onChange={(e) => setValues((v) => ({ ...v, business_name: e.target.value }))}
            className={inputClass}
          />
        </Field>

        <Field id="contact_name" label="Contact name" error={state?.fieldErrors?.contact_name}>
          <input
            id="contact_name"
            name="contact_name"
            type="text"
            maxLength={120}
            value={values.contact_name}
            onChange={(e) => setValues((v) => ({ ...v, contact_name: e.target.value }))}
            className={inputClass}
          />
        </Field>

        <Field
          id="email"
          label="Email"
          error={state?.fieldErrors?.email}
          hint="Where the secure upload link is sent."
        >
          <input
            id="email"
            name="email"
            type="email"
            required
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="phone" label="Phone" error={state?.fieldErrors?.phone}>
            <input
              id="phone"
              name="phone"
              type="tel"
              maxLength={40}
              value={values.phone}
              onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field id="trade" label="Trade" error={state?.fieldErrors?.trade}>
            <input
              id="trade"
              name="trade"
              type="text"
              maxLength={80}
              placeholder="e.g. Electrician"
              value={values.trade}
              onChange={(e) => setValues((v) => ({ ...v, trade: e.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>

        {stepOneError && <p className="text-sm text-expired">{stepOneError}</p>}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleContinue}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Continue
          </button>
        </div>
      </div>

      {/* Step 2 */}
      <div
        className={`space-y-4 rounded-card border border-line bg-surface shadow-sm p-6 ${
          step === 2 ? "" : "hidden"
        }`}
      >
        <div>
          <h2 className="text-base font-semibold">Documents to request</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            The contractor will be asked to upload each of these.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="sr-only">Select required documents</legend>
          {documentTypes.map((dt) => {
            const isOn = selected.has(dt.id);
            return (
              <label
                key={dt.id}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors ${
                  isOn
                    ? "border-brand bg-brand-tint"
                    : "border-line hover:bg-surface-muted"
                }`}
              >
                <input
                  type="checkbox"
                  name="document_type_ids"
                  value={dt.id}
                  checked={isOn}
                  onChange={() => toggle(dt.id)}
                  className="sr-only"
                />
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    isOn ? "border-brand bg-brand text-white" : "border-line-strong bg-surface"
                  }`}
                  aria-hidden
                >
                  {isOn && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span>
                  <span className="font-medium">{dt.name}</span>
                  <span className="block text-xs text-ink-muted">
                    Valid {dt.default_duration_months}{" "}
                    {dt.default_duration_months === 1 ? "month" : "months"}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {state?.fieldErrors?.document_type_ids && (
          <p className="text-sm text-expired">
            {state.fieldErrors.document_type_ids}
          </p>
        )}

        {state?.error && (
          <p className="rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
            {state.error}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={pending || selected.size === 0}
            className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
          >
            {pending && <Spinner className="h-4 w-4" />}
            {pending ? "Sending request…" : "Send onboarding request"}
          </button>
        </div>
      </div>
    </form>
  );
}
