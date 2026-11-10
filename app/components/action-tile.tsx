import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * A quick-action tile: icon over label, link to a page that really exists.
 * `primary` is the one navy tile; the rest are bordered surfaces. Only
 * clickable tiles lift on hover, and the lift is off for reduced motion.
 */
export function ActionTile({
  href,
  icon: Icon,
  label,
  variant = "secondary",
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const primary = variant === "primary";
  return (
    <Link
      href={href}
      className={`group flex min-h-28 flex-col items-center justify-center gap-3 rounded-lg border px-3 py-4 text-center text-sm font-semibold shadow-sm transition-[transform,box-shadow,background-color,border-color] duration-[var(--duration-base)] hover:shadow-md motion-safe:hover:-translate-y-0.5 ${
        primary
          ? "border-brand bg-brand text-white hover:bg-brand-hover"
          : "border-line bg-surface text-ink hover:border-line-strong"
      }`}
    >
      <span
        aria-hidden
        className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${
          primary ? "bg-white/15 text-white" : "bg-brand-tint text-brand"
        }`}
      >
        <Icon className="h-6 w-6" strokeWidth={2} />
      </span>
      <span className="leading-tight">{label}</span>
    </Link>
  );
}
