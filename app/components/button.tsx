import Link from "next/link";

import { Spinner } from "./spinner";

/**
 * The one button in the system. Three variants, three sizes.
 *
 * `pending` renders the spinner and disables the control in one step, since
 * every async action in this app needs both and doing them separately is how
 * you end up with a double-submitted form.
 *
 * Every filled or bordered variant carries a resting shadow that deepens and
 * lifts by a hairline on hover, settling back down on press — previously
 * these had zero shadow at any state, which read as flat regardless of how
 * substantial the color said it should feel. `ghost` is deliberately exempt:
 * it's meant to read as bare text with a hover background, and giving it the
 * same elevation as a real button would blur that distinction everywhere
 * it's used next to one (e.g. the two "Cancel" buttons in delete-account-
 * section.tsx). Timing comes from the shared --duration-fast/--ease-standard
 * tokens rather than Tailwind's defaults, even though the two happen to
 * currently coincide, so every button keeps moving in lockstep if the tokens
 * ever change.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "danger-outline";
export type ButtonSize = "sm" | "md" | "lg";

const LIFT =
  "shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-px active:translate-y-0 active:shadow-[var(--shadow-sm)] disabled:translate-y-0 disabled:shadow-[var(--shadow-sm)]";

const VARIANT: Record<ButtonVariant, string> = {
  primary: `bg-brand text-white border border-transparent hover:bg-brand-hover ${LIFT}`,
  secondary: `bg-surface text-ink border border-line-strong hover:bg-surface-muted ${LIFT}`,
  ghost:
    "bg-transparent text-ink-muted border border-transparent hover:bg-surface-muted hover:text-ink",
  danger: `bg-expired text-white border border-transparent hover:opacity-90 ${LIFT}`,
  // A destructive action that isn't the final, committed step yet (opening a
  // confirmation, starting a cancellation flow) — real button weight via a
  // border, coloured to read as intentional-but-not-yet-final, distinct from
  // both a neutral secondary action and the solid `danger` confirm button.
  "danger-outline": `bg-surface text-expired border border-expired-line hover:bg-expired-bg ${LIFT}`,
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-sm gap-2",
};

const BASE =
  "inline-flex items-center justify-center rounded-md font-medium transition-[background-color,color,box-shadow,transform,opacity] duration-[var(--duration-fast)] ease-[var(--ease-standard)] disabled:cursor-not-allowed disabled:opacity-60";

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = "",
): string {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`;
}

type ButtonProps = Omit<React.ComponentProps<"button">, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  pending?: boolean;
  fullWidth?: boolean;
  className?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  pending = false,
  fullWidth = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || pending}
      className={buttonClasses(
        variant,
        size,
        `${fullWidth ? "w-full" : ""} ${className}`,
      )}
    >
      {pending && <Spinner className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />}
      {children}
    </button>
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/** Same visual treatment as Button, for things that are really navigation. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link {...props} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}
