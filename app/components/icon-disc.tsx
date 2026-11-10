import type { LucideIcon } from "lucide-react";

/**
 * The saturated round icon used across the v4 surfaces (stat tiles, section
 * card headers, row leaders, action tiles). One recipe so every disc is the
 * same size scale and the same colour pairing.
 *
 * Glyphs are white on the saturated discs. The amber disc is the exception: a
 * white glyph on amber is about 2:1, so it carries a near-black glyph. The disc
 * is decorative either way (a label always sits beside it), but the glyph
 * should still be readable.
 */

export type DiscTone = "approved" | "pending" | "expiring" | "expired" | "brand" | "neutral";

const TONE: Record<DiscTone, string> = {
  approved: "bg-tile-approved-disc text-white",
  pending: "bg-tile-pending-disc text-white",
  expiring: "bg-tile-expiring-disc text-warm-900",
  expired: "bg-tile-expired-disc text-white",
  brand: "bg-brand text-white",
  neutral: "bg-surface-muted text-ink-muted border border-line",
};

const SIZE = {
  sm: { box: "h-10 w-10", icon: "h-5 w-5" },
  md: { box: "h-12 w-12", icon: "h-6 w-6" },
  lg: { box: "h-14 w-14", icon: "h-7 w-7" },
} as const;

export function IconDisc({
  icon: Icon,
  tone = "brand",
  size = "md",
  className = "",
}: {
  icon: LucideIcon;
  tone?: DiscTone;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${s.box} ${TONE[tone]} ${className}`}
    >
      <Icon className={s.icon} strokeWidth={2.25} />
    </span>
  );
}
