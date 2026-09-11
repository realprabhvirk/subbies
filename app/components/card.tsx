/**
 * Card surfaces and the stat tile built on top of one.
 *
 * `padded={false}` is for cards whose content manages its own padding —
 * tables, lists with full-bleed dividers, anything with a header band.
 *
 * `interactive` adds the hover lift + deeper shadow for a card that's
 * genuinely a clickable unit. Leave it false (the default) for a card that
 * only displays information — a StatCard, a static form panel — since a
 * card that visibly reacts to hover but goes nowhere reads as a bug, not
 * polish.
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
      className={`rounded-card border border-line bg-surface shadow-sm transition-[box-shadow,transform] duration-[var(--duration-base)] ease-[var(--ease-standard)] ${
        interactive ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : ""
      } ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/** The header band at the top of a full-bleed card: title, sub, optional action. */
export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
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

const TONE_BG: Record<StatTone, string> = {
  neutral: "bg-neutral-status-bg",
  approved: "bg-approved-bg",
  review: "bg-review-bg",
  attention: "bg-attention-bg",
  expired: "bg-expired-bg",
};

const TONE_BAR: Record<StatTone, string> = {
  neutral: "bg-neutral-status",
  approved: "bg-approved",
  review: "bg-review",
  attention: "bg-attention",
  expired: "bg-expired",
};

/**
 * A single headline number. The icon sits in a tinted tile in its status
 * colour, the value is display-face and tabular, and an optional share bar
 * gives the number context against the total without needing a chart.
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
  /** 0–1. Renders a thin proportion bar under the value. */
  share?: number;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${TONE_BG[tone]} ${TONE_TEXT[tone]}`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
        )}
        <span className="text-sm font-medium text-ink-muted">{label}</span>
      </div>

      <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-brand-ink">
        {value}
      </p>

      {note && <p className="mt-1 text-xs text-ink-subtle">{note}</p>}

      {share !== undefined && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted"
          aria-hidden
        >
          <div
            className={`h-full rounded-full ${TONE_BAR[tone]}`}
            style={{ width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%` }}
          />
        </div>
      )}
    </Card>
  );
}
