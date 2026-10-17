import Link from "next/link";

import { Spinner } from "./spinner";
import { buttonClasses, type ButtonVariant, type ButtonSize } from "./button-styles";

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
 * The class recipes live in ./button-styles.ts (no imports) so styled links
 * can use them without pulling in Spinner.
 */

export { buttonClasses, type ButtonVariant, type ButtonSize };

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
