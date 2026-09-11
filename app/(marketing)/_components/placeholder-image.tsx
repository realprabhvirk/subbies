/**
 * A neutral, clearly-labelled stand-in for a photo slot that hasn't been
 * shot yet — deliberately not a stock photo. The previous homepage used
 * real (if generic) stock images in these positions, which is exactly the
 * "we didn't bother sourcing real photography" tell this pass is meant to
 * remove; a labelled placeholder is honest about what's still missing and
 * makes the swap-in trivial (drop a real image at the same path, done).
 *
 * Solid warm-neutral fill, a dashed border, and a centered spec label —
 * no icon, no gradient, nothing that could be mistaken for finished art.
 */
export function PlaceholderImage({
  label,
  spec,
  className = "",
  dark = false,
}: {
  /** e.g. "Hero image" */
  label: string;
  /** e.g. "1920×1080 · job site, wide" */
  spec: string;
  className?: string;
  /** Darker fill for slots that sit under white overlay text (the hero). */
  dark?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-center border border-dashed p-6 text-center ${
        dark
          ? "border-white/25 bg-warm-800"
          : "border-line-strong bg-warm-100"
      } ${className}`}
    >
      <div>
        <p
          className={`text-xs font-semibold uppercase tracking-[0.08em] ${
            dark ? "text-white/70" : "text-ink-subtle"
          }`}
        >
          {label}
        </p>
        <p className={`mt-1 text-xs ${dark ? "text-white/50" : "text-ink-subtle"}`}>
          {spec}
        </p>
      </div>
    </div>
  );
}
