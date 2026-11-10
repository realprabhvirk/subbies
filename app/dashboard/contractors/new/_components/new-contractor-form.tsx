"use client";

import { useActionState, useMemo, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/app/components/button";
import { Field, fieldClasses } from "@/app/components/input";
import type { DocumentType } from "@/lib/types";
import { createContractor, type NewContractorState } from "../../actions";

const STEP_ONE_FIELDS = ["business_name", "contact_name", "email", "phone", "trade"] as const;

// The shared field treatment, so these forms can't drift from the rest.
const inputClass = fieldClasses();

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
    <form action={formAction} className="max-w-2xl space-y-5">
      {/* Step indicator */}
      <ol className="grid grid-cols-2 gap-2 text-sm">
        {(["Details", "Documents"] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2;
          const current = step === n;
          const done = step > n;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={`flex items-center gap-2.5 border-t-[3px] pt-3 ${
                current || done ? "border-brand text-ink" : "border-line-strong text-ink-muted"
              }`}
            >
              <span className="font-mono text-xs">0{n}</span>
              <span className={current ? "font-semibold" : "font-medium"}>{label}</span>
            </li>
          );
        })}
      </ol>

      {/* Step 1 — kept mounted so its values submit with the form */}
      <div
        className={`space-y-5 rounded-card border border-line bg-surface p-card shadow-sm sm:p-6 ${
          step === 1 ? "" : "hidden"
        }`}
      >
        <Field htmlFor="business_name" label="Business name" error={state?.fieldErrors?.business_name}>
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

        <Field htmlFor="contact_name" label="Contact name" error={state?.fieldErrors?.contact_name}>
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
          htmlFor="email"
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
          <Field htmlFor="phone" label="Phone" error={state?.fieldErrors?.phone}>
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
          <Field htmlFor="trade" label="Trade" error={state?.fieldErrors?.trade}>
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

        <div className="flex justify-end border-t border-line pt-4">
          <Button type="button" onClick={handleContinue}>
            Continue
          </Button>
        </div>
      </div>

      {/* Step 2 */}
      <div
        className={`space-y-5 rounded-card border border-line bg-surface p-card shadow-sm sm:p-6 ${
          step === 2 ? "" : "hidden"
        }`}
      >
        <div>
          <h2 className="text-card-title">Documents to request</h2>
          <p className="mt-1 text-sm text-ink-muted">
            The contractor will be asked to upload each of these.
          </p>
        </div>

        <fieldset className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          <legend className="sr-only">Select required documents</legend>
          {documentTypes.map((dt) => {
            const isOn = selected.has(dt.id);
            return (
              <label
                key={dt.id}
                className={`flex min-h-16 cursor-pointer items-start gap-3.5 px-4 py-4 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-brand ${
                  isOn ? "bg-brand-tint/60" : "hover:bg-surface-muted/70"
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
                  className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    isOn ? "border-brand bg-brand text-white" : "border-field-line bg-surface"
                  }`}
                  aria-hidden
                >
                  {isOn && <Check className="h-4 w-4" strokeWidth={3} />}
                </span>
                <span>
                  <span className="font-semibold">{dt.name}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
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
          <p className="rounded-md border border-expired-line bg-expired-bg/70 px-3 py-2 text-sm text-expired">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={() => setStep(1)}>
            Back
          </Button>
          <Button type="submit" disabled={selected.size === 0} pending={pending}>
            {pending ? "Sending request…" : "Send onboarding request"}
          </Button>
        </div>
      </div>
    </form>
  );
}
