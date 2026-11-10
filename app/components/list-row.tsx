import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * One row of a list: a leading element (avatar, icon disc), a 17px semibold
 * title, a 15px meta line, a trailing slot (status pill, counts), optional
 * `actions` (real buttons) and a chevron when the row links somewhere. At least
 * 64px tall, so it is a real tap target; hover tints the row; keyboard focus
 * draws an inset ring on the whole row.
 *
 * The row is ONE real anchor: the title is the link, stretched over the row by
 * an ::after. Anything that must stay clickable on its own (`actions`) sits
 * above that overlay, so a button is never nested inside a link, and
 * middle-click, keyboard and screen readers all behave. Titles truncate
 * cleanly: a 90-character company name never pushes the pill off the row.
 *
 * `footer` is a second line for phones (pill, counts, date) and is hidden from
 * `md` up, where the same things live in `trailing`. When a footer is given,
 * `actions` also move into it on phones (rendered once per breakpoint, so the
 * name keeps the width).
 *
 * Render rows inside <RowList> for the dividers and the <li> semantics.
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

export function ListRow({
  href,
  leading,
  title,
  meta,
  trailing,
  actions,
  footer,
  className = "",
}: {
  href?: string;
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      className={`group relative flex min-h-16 gap-3.5 px-card py-3.5 sm:px-6 ${footer ? "items-start md:items-center" : "items-center"} ${
        href ? "transition-colors duration-[var(--duration-fast)] hover:bg-surface-muted" : ""
      } ${className}`}
    >
      {leading}
      <div className="min-w-0 flex-1">
        {href ? (
          <Link
            href={href}
            className="block truncate text-sm font-semibold text-ink after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-inset focus-visible:after:ring-brand"
          >
            {title}
          </Link>
        ) : (
          <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        )}
        {meta && <span className="mt-0.5 block truncate text-xs text-ink-muted">{meta}</span>}
        {footer && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 md:hidden">
            {footer}
            {actions && <div className="relative z-10 w-full">{actions}</div>}
          </div>
        )}
      </div>
      {trailing && (
        <div className={`shrink-0 items-center gap-3 ${footer ? "hidden md:flex" : "flex"}`}>
          {trailing}
        </div>
      )}
      {actions && (
        <div className={`relative z-10 shrink-0 ${footer ? "hidden md:block" : ""}`}>{actions}</div>
      )}
      {href && (
        <ChevronRight
          aria-hidden
          className="h-5 w-5 shrink-0 text-ink-subtle transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5 group-hover:text-ink"
          strokeWidth={2}
        />
      )}
    </li>
  );
}
