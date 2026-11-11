import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

import { IconDisc } from "./icon-disc";

/**
 * The tinted stat tile: a soft status-coloured surface, one saturated icon
 * disc, a label, a 64px figure and a caption. Labels and figures stay
 * near-black for contrast; only the disc carries the saturated colour.
 *
 * Give it an `href` only when it goes somewhere real: then the whole tile is a
 * link with a trailing arrow and a hover lift. `progress` (0 to 1) draws a bar
 * in the disc colour with a text alternative.
 */

/** Status tones for compliance counts; `brand` for anything that isn't compliance (plan usage). */
export type StatTileTone = "approved" | "pending" | "expiring" | "expired" | "brand";

const SURFACE: Record<StatTileTone, string> = {
  approved: "bg-tile-approved",
  pending: "bg-tile-pending",
  expiring: "bg-tile-expiring",
  expired: "bg-tile-expired",
  brand: "bg-brand-tint",
};

const BAR: Record<StatTileTone, string> = {
  approved: "bg-tile-approved-disc",
  pending: "bg-tile-pending-disc",
  expiring: "bg-tile-expiring-disc",
  expired: "bg-tile-expired-disc",
  brand: "bg-brand",
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
      {/* Phone: disc over label (the tile is only ~165px wide). From sm up
          they sit side by side. The arrow is pinned top right either way. */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:pr-8">
        <IconDisc icon={icon} tone={tone} size="md" />
        <p className="min-w-0 text-sm font-semibold leading-tight text-ink">{label}</p>
      </div>
      {href && (
        <ArrowRight
          className="absolute right-4 top-4 h-5 w-5 text-ink transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5 sm:right-6 sm:top-6"
          strokeWidth={2.25}
          aria-hidden
        />
      )}
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

  const base = `relative block min-w-0 rounded-card p-card sm:p-6 ${SURFACE[tone]} ${className}`;
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
