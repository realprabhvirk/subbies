import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The page header for every dashboard screen: an optional back link, a 13px
 * caps eyebrow, a big title, a subtitle and actions pinned right (wrapping
 * under on a phone).
 *
 * `size="hero"` is the dashboard greeting (56px, 36px on phones). `band` is an
 * optional decorative element (the dashboard photo) laid behind the right-hand
 * side of the header; it is aria-hidden by the caller and hidden on phones by
 * the band component itself.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  back,
  actions,
  meta,
  size = "page",
  band,
  rule = false,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /** A row under the description: contact details, dates, a status pill. */
  meta?: React.ReactNode;
  size?: "page" | "hero";
  band?: React.ReactNode;
  /** A hairline under the header. Off by default in v4. */
  rule?: boolean;
}) {
  return (
    <header className={`relative isolate ${rule ? "border-b border-line pb-6" : ""}`}>
      {band}
      {back && (
        <Link
          href={back.href}
          className="group -ml-2 mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft
            className="h-4 w-4 transition-transform duration-[var(--duration-fast)] group-hover:-translate-x-0.5"
            strokeWidth={2.25}
            aria-hidden
          />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && <div className="label-caps mb-2.5 text-ink-muted">{eyebrow}</div>}
          <h1
            className={`tracking-display ${
              size === "hero" ? "text-hero" : "text-page-title"
            }`}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-3 text-base text-ink-muted">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">{actions}</div>
        )}
      </div>
      {meta && <div className="mt-5">{meta}</div>}
    </header>
  );
}
