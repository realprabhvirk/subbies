import Link from "next/link";

import { Spinner } from "./spinner";

/**
 * The one button in the system. Five variants, three sizes.
 *
 * `pending` renders the spinner and disables the control in one step, since
 * every async action in this app needs both and doing them separately is how
 * you end up with a double-submitted form.
 *
 * v3: buttons are flat. They don't hover-lift or cast shadows — feedback is
 * a colour change on hover and a small press-in on pointer-down (`.pressable`
 * in globals.css), which is what a control should do: respond to the hand,
 * not float. Primary is the only solid fill on a screen; secondary is a
 * bordered paper button; ghost is bare text.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "danger-outline";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white border border-brand hover:bg-brand-hover hover:border-brand-hover active:bg-brand-active",
  secondary:
    "bg-surface text-ink border border-line-strong hover:border-field-line hover:bg-surface-muted",
  ghost:
    "bg-transparent text-ink-muted border border-transparent hover:bg-surface-muted hover:text-ink",
  danger:
    "bg-expired text-white border border-expired hover:bg-[color-mix(in_oklch,var(--color-expired)_88%,var(--color-warm-900))]",
  // A destructive action that isn't the final, committed step yet (opening a
  // confirmation, starting a cancellation flow): real weight via a border,
  // coloured to read as intentional-but-not-final.
  "danger-outline":
    "bg-surface text-expired border border-expired-line hover:bg-expired-bg hover:border-expired",
};

// Heights: sm 36px, md 44px, lg 52px. md and lg clear the 44px touch-target
// guideline; md matches fieldClasses' input height so a button beside an
// input lines up.
const SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs gap-1.5",
  md: "h-11 px-4.5 text-sm gap-2",
  lg: "h-13 px-6 text-base gap-2.5",
};

const BASE =
  "pressable inline-flex items-center justify-center whitespace-nowrap rounded-md font-semibold tracking-[-0.005em] disabled:cursor-not-allowed disabled:opacity-55";

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
      {pending && <Spinner className={size === "lg" ? "h-5 w-5" : "h-4 w-4"} />}
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
