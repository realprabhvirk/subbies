import Image from "next/image";

/**
 * The Subbies lockup: the real brand mark plus a live-text wordmark.
 *
 * The mark is the actual asset. The wordmark and tagline are rendered as text
 * rather than using the full-lockup PNG, because that asset bakes the tagline
 * in at roughly 1/20th of its width — at the 28–42px heights this is used at,
 * the tagline degrades into unreadable grey mush. As text it stays crisp at
 * every size and matches the proportions in the dashboard mockup.
 *
 * The white mark is a mechanical recolor of the navy one, not a purpose-made
 * dark lockup. Fine at this size; worth replacing before it's used large.
 */

const MARK = {
  brand: "/brand/subbies-icon.png",
  inverse: "/brand/subbies-icon-white.png",
} as const;

export function Logo({
  className = "",
  tone = "brand",
  iconOnly = false,
  showTagline = false,
  height = 28,
  priority = false,
}: {
  className?: string;
  /** "inverse" for the dark sidebar or any dark surface. */
  tone?: "brand" | "inverse";
  /** Just the mark, no wordmark. */
  iconOnly?: boolean;
  /** Adds the "Compliance builds progress" line under the wordmark. */
  showTagline?: boolean;
  /** Height of the mark in px. The wordmark scales with it. */
  height?: number;
  priority?: boolean;
}) {
  const mark = (
    <Image
      src={MARK[tone]}
      alt={iconOnly ? "Subbies" : ""}
      width={height}
      height={height}
      priority={priority}
      className="block shrink-0 object-contain"
      style={{ height, width: height }}
    />
  );

  if (iconOnly) return <span className={className}>{mark}</span>;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {mark}
      <span className="flex flex-col justify-center leading-none">
        <span
          className={`font-display font-bold tracking-tight ${
            tone === "inverse" ? "text-sidebar-ink" : "text-ink"
          }`}
          style={{ fontSize: Math.round(height * 0.62) }}
        >
          Subbies
        </span>
        {showTagline && (
          <span
            className={`mt-1 font-semibold uppercase ${
              tone === "inverse" ? "text-sidebar-ink-subtle" : "text-ink-subtle"
            }`}
            style={{
              fontSize: Math.max(8, Math.round(height * 0.26)),
              letterSpacing: "0.14em",
            }}
          >
            Compliance builds progress
          </span>
        )}
      </span>
    </span>
  );
}
