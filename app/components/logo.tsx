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
  size,
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
  /**
   * Brand-header preset: a 36px mark and 22px wordmark from sm up, 32px and
   * 20px on phones. Overrides `height`. Used by the marketing nav and
   * footer, auth pages and the contractor upload page.
   */
  size?: "brand";
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

  if (size === "brand") {
    return (
      <span className={`inline-flex items-center gap-3 ${className}`}>
        <Image
          src={MARK[tone]}
          alt={iconOnly ? "Subbies" : ""}
          width={36}
          height={36}
          priority={priority}
          className="block h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
        />
        {!iconOnly && (
          <span className="flex flex-col justify-center leading-none">
            <span
              className={`font-display text-xl font-semibold tracking-[-0.02em] stretch-wide sm:text-[22px] ${
                tone === "inverse" ? "text-sidebar-ink" : "text-ink"
              }`}
            >
              Subbies
            </span>
            {showTagline && (
              <span
                className={`mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] sm:text-xs ${
                  tone === "inverse" ? "text-sidebar-ink-muted" : "text-ink-muted"
                }`}
              >
                Compliance builds progress
              </span>
            )}
          </span>
        )}
      </span>
    );
  }

  if (iconOnly) return <span className={className}>{mark}</span>;

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {mark}
      <span className="flex flex-col justify-center leading-none">
        <span
          className={`font-display font-bold tracking-[-0.02em] stretch-wide ${
            tone === "inverse" ? "text-sidebar-ink" : "text-ink"
          }`}
          style={{ fontSize: Math.round(height * 0.6) }}
        >
          Subbies
        </span>
        {showTagline && (
          <span
            className={`mt-1.5 font-semibold uppercase ${
              tone === "inverse" ? "text-sidebar-ink-muted" : "text-ink-muted"
            }`}
            style={{
              // Never below 10.5px: the old 8–9px tagline was unreadable.
              fontSize: Math.max(10.5, Math.round(height * 0.3)),
              letterSpacing: "0.1em",
            }}
          >
            Compliance builds progress
          </span>
        )}
      </span>
    </span>
  );
}
