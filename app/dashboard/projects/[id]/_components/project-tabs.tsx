"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Lock } from "lucide-react";

export interface ProjectTab {
  /** URL segment under the project; null is the overview. */
  segment: string | null;
  label: string;
  /** Shown with a lock: the tab opens the plan's locked state. */
  locked?: boolean;
}

/**
 * The workspace tab strip. Each tab is a nested route sharing the project
 * layout, so switching tabs keeps the header and shows that tab's own
 * skeleton while it loads.
 */
export function ProjectTabs({ projectId, tabs }: { projectId: string; tabs: ProjectTab[] }) {
  const segment = useSelectedLayoutSegment();
  return (
    <nav
      aria-label="Project sections"
      className="-mx-(--page-padding) flex gap-1 overflow-x-auto px-(--page-padding) shadow-[inset_0_-1px_0_var(--color-line)] sm:mx-0 sm:px-0"
    >
      {tabs.map((t) => {
        const active = (t.segment ?? null) === (segment ?? null);
        const href = `/dashboard/projects/${projectId}${t.segment ? `/${t.segment}` : ""}`;
        return (
          <Link
            key={t.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex h-12 shrink-0 items-center gap-2 whitespace-nowrap border-b-[3px] px-4 text-sm transition-colors ${
              active
                ? "border-brand font-semibold text-ink"
                : "border-transparent font-medium text-ink-muted hover:border-line-strong hover:text-ink"
            }`}
          >
            {t.label}
            {t.locked && (
              <>
                <Lock className="h-3.5 w-3.5 text-ink-subtle" strokeWidth={2.25} aria-hidden />
                <span className="sr-only">(not in your plan)</span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
