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
  | "danger-outline"
  /** Marketing secondary: surface fill, navy border and text. Same weight as primary. */
  | "outline"
  /** On a dark navy band: white fill, navy text. */
  | "inverse"
  /** On a dark navy band: white outline, white text. */
  | "inverse-outline";
/**
 * sm/md are the app's sizes. lg (56px) is for hero and section calls to
 * action; cta (48px, larger type) for marketing nav and card buttons.
 */
export type ButtonSize = "sm" | "md" | "lg" | "cta";

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
  outline:
    "bg-surface text-brand border-[1.5px] border-brand hover:bg-brand-tint",
  inverse:
    "bg-sidebar-ink text-brand border border-sidebar-ink hover:bg-white",
  "inverse-outline":
    "bg-transparent text-sidebar-ink border-[1.5px] border-sidebar-ink/80 hover:bg-white/10 hover:border-sidebar-ink",
};

// Heights: sm 40px, md 48px, lg 56px (chunky, easy to hit with a glove on).
// md matches fieldClasses' input height so a button beside an input lines up.
// Every size clears the 44px touch-target guideline.
const SIZE: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-xs gap-1.5",
  md: "h-12 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  cta: "h-11 px-5 text-[15px] gap-2",
};

// The big marketing buttons get a soft shadow and a 1px lift on hover
// (colour-only under reduced motion). App-sized buttons stay flat.
const LIFT =
  "shadow-[0_1px_2px_rgb(22_40_63/0.12),0_4px_12px_-2px_rgb(22_40_63/0.18)] hover:-translate-y-px hover:shadow-[0_2px_4px_rgb(22_40_63/0.14),0_10px_22px_-6px_rgb(22_40_63/0.28)] motion-reduce:hover:translate-y-0";

const BASE =
  "pressable inline-flex items-center justify-center whitespace-nowrap rounded-md font-semibold tracking-[-0.005em] disabled:cursor-not-allowed disabled:opacity-55";

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = "",
): string {
  const lift = (size === "lg" || size === "cta") && (variant === "primary" || variant === "inverse") ? LIFT : "";
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${lift} ${className}`;
}
