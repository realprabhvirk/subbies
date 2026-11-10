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
  return `block w-full min-h-12 rounded-md border bg-surface px-4 py-3 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-[var(--duration-fast)] placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted ${
    invalid ? "border-expired" : "border-field-line hover:border-ink-subtle"
  } ${className}`;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  /**
   * ReactNode rather than string so a label can carry an inline qualifier —
   * the de-emphasised "(optional)" the settings forms use — without those
   * forms having to re-implement this wrapper to get it.
   */
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-expired">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode;
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
