/**
 * The panel surface, plus the shared status-tone type used by figure rows.
 *
 * v3: a panel is paper on the canvas — a hairline border and an 8px corner,
 * no floating shadow. Structure comes from rules, not elevation.
 *
 * `padded={false}` is for panels whose content manages its own padding —
 * tables, lists with full-bleed rules, anything with a header band.
 *
 * `interactive` adds a border/background response for a panel that is
 * genuinely one clickable unit. Leave it false for a panel that only shows
 * information: a panel that reacts to hover but goes nowhere reads as a bug.
 */

export function Card({
  className = "",
  padded = true,
  interactive = false,
  children,
}: {
  className?: string;
  padded?: boolean;
  interactive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-card border border-line bg-surface shadow-sm ${
        interactive
          ? "cursor-pointer transition-colors duration-[var(--duration-fast)] hover:border-line-strong hover:bg-surface-muted/40"
          : ""
      } ${padded ? "p-card sm:p-6" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export type StatTone = "neutral" | "approved" | "review" | "attention" | "expired";
