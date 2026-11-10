import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

import { IconDisc, type DiscTone } from "./icon-disc";

/**
 * The tinted stat tile: a soft status-coloured surface, one saturated icon
 * disc, a label, a 64px figure and a caption. Labels and figures stay
 * near-black for contrast; only the disc carries the saturated colour.
 *
 * Give it an `href` only when it goes somewhere real: then the whole tile is a
 * link with a trailing arrow and a hover lift. `progress` (0 to 1) draws a bar
 * in the disc colour with a text alternative.
 */

export type StatTileTone = "approved" | "pending" | "expiring" | "expired";

const SURFACE: Record<StatTileTone, string> = {
  approved: "bg-tile-approved",
  pending: "bg-tile-pending",
  expiring: "bg-tile-expiring",
  expired: "bg-tile-expired",
};

const BAR: Record<StatTileTone, string> = {
  approved: "bg-tile-approved-disc",
  pending: "bg-tile-pending-disc",
  expiring: "bg-tile-expiring-disc",
  expired: "bg-tile-expired-disc",
};

export function StatTile({
  tone,
  icon,
  label,
  value,
  caption,
  progress,
  progressLabel,
  href,
  className = "",
}: {
  tone: StatTileTone;
  icon: LucideIcon;
  label: string;
  value: number | string;
  caption?: React.ReactNode;
  progress?: number;
  progressLabel?: string;
  href?: string;
  className?: string;
}) {
  const share = progress === undefined ? undefined : Math.max(0, Math.min(1, progress));
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <IconDisc icon={icon} tone={tone} size="md" />
          <p className="min-w-0 text-sm font-semibold leading-tight text-ink">{label}</p>
        </div>
        {href && (
          <ArrowRight
            className="h-5 w-5 shrink-0 text-ink transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5"
            strokeWidth={2.25}
            aria-hidden
          />
        )}
      </div>
      <p className="figure mt-5 text-stat text-ink">{value}</p>
      {caption && <p className="mt-2 text-xs text-ink-muted">{caption}</p>}
      {share !== undefined && (
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-white/70"
          role="img"
          aria-label={progressLabel ?? `${Math.round(share * 100)}%`}
        >
          <div className={`h-full rounded-full ${BAR[tone]}`} style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
      )}
    </>
  );

  const base = `block min-w-0 rounded-card p-card sm:p-6 ${SURFACE[tone]} ${className}`;
  if (href) {
    return (
      <Link
        href={href}
        className={`${base} group shadow-sm transition-[transform,box-shadow] duration-[var(--duration-base)] hover:shadow-md motion-safe:hover:-translate-y-0.5`}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}
