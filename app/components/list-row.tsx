import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * One row of a list: a leading element (avatar, icon disc, colour bar), a 17px
 * semibold title, a 15px meta line, a trailing slot (usually a status pill) and
 * a chevron when it links somewhere. At least 64px tall, so it's a real tap
 * target; hover tints the row; focus draws the ring.
 *
 * Render rows inside <RowList> so the dividers and the <li> semantics come for
 * free. Titles truncate cleanly: a 90-character company name never pushes the
 * pill off the row.
 */
export function RowList({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <ul className={`divide-y divide-line border-t border-line ${className}`}>{children}</ul>;
}

const ROW =
  "group flex min-h-16 w-full items-center gap-3.5 px-card py-3 text-left sm:px-6";

export function ListRow({
  href,
  leading,
  title,
  meta,
  trailing,
  className = "",
}: {
  href?: string;
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-xs text-ink-muted">{meta}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
      {href && (
        <ChevronRight
          className="h-5 w-5 shrink-0 text-ink-subtle transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5 group-hover:text-ink"
          strokeWidth={2}
          aria-hidden
        />
      )}
    </>
  );

  if (href) {
    return (
      <li>
        <Link
          href={href}
          className={`${ROW} transition-colors duration-[var(--duration-fast)] hover:bg-surface-muted focus-visible:bg-surface-muted ${className}`}
        >
          {body}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <div className={`${ROW} ${className}`}>{body}</div>
    </li>
  );
}
