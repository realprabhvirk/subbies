import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The page header pattern for every dashboard screen: an optional back link,
 * an optional caps eyebrow, the title in the semi-expanded display setting,
 * a one-line description, and actions pinned right (wrapping under on a
 * phone). Ends on a hairline rule so the page body starts on a clean line.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  back,
  actions,
  meta,
  rule = true,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /** A row under the description — contact details, dates, a status stamp. */
  meta?: React.ReactNode;
  rule?: boolean;
}) {
  return (
    <header className={rule ? "border-b border-line pb-6" : ""}>
      {back && (
        <Link
          href={back.href}
          className="group -ml-1 mb-4 inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft
            className="h-4 w-4 transition-transform duration-[var(--duration-fast)] group-hover:-translate-x-0.5"
            strokeWidth={2.25}
            aria-hidden
          />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && <div className="label-caps mb-2 text-ink-subtle">{eyebrow}</div>}
          <h1 className="text-2xl sm:text-3xl">{title}</h1>
          {description && (
            <p className="mt-2 text-sm text-ink-muted">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {meta && <div className="mt-4">{meta}</div>}
    </header>
  );
}
