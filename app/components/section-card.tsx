import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

import { IconDisc, type DiscTone } from "./icon-disc";

/**
 * The v4 content card: a 20px-radius surface with an icon-disc header, a
 * 28px title, an optional count badge and an optional "View all" link.
 *
 * `flush` lets a list run edge to edge under the header (ListRow dividers
 * reach the card's border); without it the body gets card padding.
 */
export function SectionCard({
  id,
  icon,
  tone = "brand",
  title,
  count,
  subtitle,
  action,
  flush = false,
  className = "",
  children,
}: {
  /** Used for aria-labelledby on the section. */
  id?: string;
  icon?: LucideIcon;
  tone?: DiscTone;
  title: React.ReactNode;
  /** A number in a small pill beside the title. Hidden when 0 or undefined. */
  count?: number;
  subtitle?: React.ReactNode;
  action?: { href: string; label: string };
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section
      aria-labelledby={titleId}
      className={`min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-sm ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-card pb-4 pt-card sm:px-6 sm:pt-6">
        <div className="flex min-w-[14rem] flex-1 items-center gap-3.5">
          {icon && <IconDisc icon={icon} tone={tone} size="md" />}
          <div className="min-w-0">
            <h2
              id={titleId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-card-title"
            >
              <span className="min-w-0 break-words">{title}</span>
              {count !== undefined && count > 0 && (
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-expired px-2 font-mono text-2xs font-medium text-white">
                  {count}
                </span>
              )}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
          </div>
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-brand transition-colors hover:bg-brand-tint hover:underline"
          >
            {action.label}
            <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </Link>
        )}
      </header>
      <div className={flush ? "" : "px-card pb-card sm:px-6 sm:pb-6"}>{children}</div>
    </section>
  );
}
