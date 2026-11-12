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

/**
 * md is the app's field. lg is the pre-signup field (auth, contact): 52px
 * tall with 16px text, for forms people fill in once, often on a phone.
 */
export type FieldSize = "md" | "lg";

const FIELD_SIZE: Record<FieldSize, string> = {
  md: "min-h-12 text-sm",
  lg: "min-h-[52px] text-base",
};

export function fieldClasses(invalid = false, className = "", size: FieldSize = "md"): string {
  return `block w-full ${FIELD_SIZE[size]} rounded-md border bg-surface px-4 py-3 text-ink outline-none transition-[border-color,box-shadow] duration-[var(--duration-fast)] placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-muted ${
    invalid ? "border-expired" : "border-field-line hover:border-ink-subtle"
  } ${className}`;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  size = "md",
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
  size?: FieldSize;
  children: React.ReactNode;
}) {
  const lg = size === "lg";
  return (
    <div className={lg ? "space-y-2" : "space-y-1.5"}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className={`font-medium text-expired ${lg ? "text-sm" : "text-xs"}`}>{error}</p>
      ) : hint ? (
        <p className={`text-ink-muted ${lg ? "text-sm" : "text-xs"}`}>{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode;
  hint?: string;
  error?: string;
  fieldSize?: FieldSize;
};

export function Input({
  label,
  hint,
  error,
  id,
  className = "",
  fieldSize = "md",
  ...props
}: InputProps) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} size={fieldSize}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        {...props}
        className={fieldClasses(Boolean(error), className, fieldSize)}
      />
    </Field>
  );
}
