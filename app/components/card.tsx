/**
 * Panels and the figure tile built on top of one.
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

/** The header band at the top of a full-bleed panel: title, sub, optional action. */
export function CardHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Optional small caps label above the title. */
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5 sm:px-6">
      <div className="min-w-0">
        {eyebrow && <p className="label-caps mb-1 text-ink-subtle">{eyebrow}</p>}
        <h2 className="text-base font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-ink-muted sm:text-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export type StatTone = "neutral" | "approved" | "review" | "attention" | "expired";

const TONE_TEXT: Record<StatTone, string> = {
  neutral: "text-neutral-status",
  approved: "text-approved",
  review: "text-review",
  attention: "text-attention",
  expired: "text-expired",
};

const TONE_BAR: Record<StatTone, string> = {
  neutral: "bg-ink-muted",
  approved: "bg-approved",
  review: "bg-review",
  attention: "bg-attention",
  expired: "bg-expired",
};

/**
 * A single headline figure: small caps label, a big semi-expanded tabular
 * number, and an optional meter that sets the number against its total.
 * The icon (optional) sits inline with the label in the tone colour — no
 * tinted tile.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  note,
  share,
}: {
  label: string;
  value: number | string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: StatTone;
  note?: string;
  /** 0–1. Renders a thin proportion meter under the value. */
  share?: number;
}) {
  return (
    <Card>
      <div className="flex items-center gap-1.5">
        {Icon && (
          <Icon className={`h-4 w-4 shrink-0 ${TONE_TEXT[tone]}`} strokeWidth={2.25} />
        )}
        <span className="label-caps text-ink-muted">{label}</span>
      </div>

      <p className="figure mt-4 text-4xl text-ink">{value}</p>

      {note && <p className="mt-2 text-xs text-ink-muted">{note}</p>}

      {share !== undefined && (
        <div
          className="mt-4 h-1 overflow-hidden rounded-full bg-line"
          aria-hidden
        >
          <div
            className={`h-full ${TONE_BAR[tone]}`}
            style={{ width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%` }}
          />
        </div>
      )}
    </Card>
  );
}
