import { type InputHTMLAttributes } from "react";

/**
 * Text input, plus the shared field chrome (label / hint / error) that every
 * form control in the app uses.
 *
 * `fieldClasses` is exported so PasswordField and any bare <input>/<select>/
 * <textarea> can wear the same treatment without being wrapped in this
 * component — the focus ring is defined once, in globals.css, and these
 * classes only carry the resting state.
 */

export function fieldClasses(invalid = false, className = ""): string {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink outline-none transition-shadow placeholder:text-ink-subtle ${
    invalid ? "border-expired" : "border-line-strong"
  } ${className}`;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-expired">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}: InputProps) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        {...props}
        className={fieldClasses(Boolean(error), className)}
      />
    </Field>
  );
}
