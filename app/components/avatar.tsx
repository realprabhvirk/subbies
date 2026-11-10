/** Up to two initials from a name, for an avatar tile. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "–";
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
}

/**
 * An initials disc. Decorative: the name is always printed beside it.
 */
export function Avatar({
  name,
  size = "md",
  tone = "paper",
}: {
  name: string;
  size?: "sm" | "md";
  /** "paper" on light surfaces, "navy" for the shell, "brand" for emphasis. */
  tone?: "paper" | "navy" | "brand";
}) {
  const tones = {
    paper: "bg-surface-muted text-ink-muted border border-line",
    navy: "bg-sidebar-active-bg text-sidebar-ink",
    brand: "bg-brand text-white",
  } as const;
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${
        size === "sm" ? "h-9 w-9 text-2xs" : "h-11 w-11 text-xs"
      } ${tones[tone]}`}
    >
      {initialsOf(name)}
    </span>
  );
}
