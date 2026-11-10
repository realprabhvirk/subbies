/*
  The button class recipes, in a file with no imports, so a client component
  that only needs the classes (a styled <Link>) doesn't pull Button's spinner
  and icon code into its bundle. Button in ./button.tsx re-exports these.
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

// Heights: sm 40px, md 48px, lg 56px (chunky, easy to hit with a glove on).
// md matches fieldClasses' input height so a button beside an input lines up.
// Every size clears the 44px touch-target guideline.
const SIZE: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-xs gap-1.5",
  md: "h-12 px-5 text-sm gap-2",
  lg: "h-14 px-7 text-base gap-2.5",
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
