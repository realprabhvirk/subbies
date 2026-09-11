import { Spinner } from "./spinner";

/**
 * The square, icon-only sibling of Button — edit / delete / close / remove,
 * the actions that sit in a card corner or a row's right edge and never carry
 * visible text.
 *
 * Button can't cover these: its sizes are all built around a text label's
 * horizontal padding, so an icon in one renders as a wide pill. They were
 * hand-written per call site instead, and drifted — the close buttons in the
 * two dialogs ended up without the `transition-colors` and hover text colour
 * that the identically-shaped edit buttons next to them had, so the same
 * gesture animated in one place and snapped in another.
 *
 * Two tones only, matching how these actually get used: `neutral` for edit and
 * close, `danger` for the ones that remove something. Both rest at the same
 * muted ink and only diverge on hover, so a row of them reads as one control
 * group until you point at the destructive one.
 *
 * `aria-label` is required rather than optional — there's no text to fall back
 * on, so an unlabelled one is unusable rather than merely untidy.
 */

export type IconButtonTone = "neutral" | "danger";

const TONE: Record<IconButtonTone, string> = {
  neutral: "text-ink-muted hover:bg-surface-muted hover:text-ink",
  danger: "text-ink-muted hover:bg-expired-bg hover:text-expired",
};

const BASE =
  "inline-flex shrink-0 items-center justify-center rounded-md p-1.5 transition-[background-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:scale-[1.06] active:scale-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100";

type IconButtonProps = Omit<React.ComponentProps<"button">, "className"> & {
  tone?: IconButtonTone;
  /** Swaps the icon for a spinner and disables the control, as Button does. */
  pending?: boolean;
  "aria-label": string;
  className?: string;
};

export function IconButton({
  tone = "neutral",
  pending = false,
  type = "button",
  disabled,
  className = "",
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      className={`${BASE} ${TONE[tone]} ${className}`}
    >
      {pending ? <Spinner className="h-4 w-4" /> : children}
    </button>
  );
}
