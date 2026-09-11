import Link from "next/link";

import { Spinner } from "./spinner";

/**
 * The one button in the system. Three variants, three sizes.
 *
 * `pending` renders the spinner and disables the control in one step, since
 * every async action in this app needs both and doing them separately is how
 * you end up with a double-submitted form.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover border border-transparent",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-surface-muted",
  ghost:
    "bg-transparent text-ink-muted border border-transparent hover:bg-surface-muted hover:text-ink",
  danger: "bg-expired text-white border border-transparent hover:opacity-90",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-sm gap-2",
};

const BASE =
  "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

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
