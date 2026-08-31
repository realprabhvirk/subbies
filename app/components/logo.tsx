export function Logo({
  className = "",
  tone = "brand",
}: {
  className?: string;
  /** "inverse" for use on dark surfaces. */
  tone?: "brand" | "inverse";
}) {
  const wordColor = tone === "inverse" ? "text-ink-inverse" : "text-ink";
  return (
    <span
      className={`inline-flex items-center gap-2 font-display font-bold tracking-tight ${wordColor} ${className}`}
    >
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-sm bg-brand text-sm font-bold text-white"
      >
        S
      </span>
      <span className="text-lg">Subbies</span>
    </span>
  );
}
