import { Skeleton } from "@/app/components/skeleton";

/**
 * Stand-in for the whole DashboardShell (sidebar + header + content), shown
 * while dashboard-gate.tsx's auth/company/entitlement check is in flight.
 *
 * Matches DashboardShell's actual grid (same --sidebar-width/--header-height
 * tokens, same lg: breakpoint) rather than a generic centred spinner, so
 * there's no layout jump the instant the real shell replaces this — the rail
 * and header are already the right size, just empty.
 */
export function DashboardShellSkeleton() {
  return (
    <div
      className="min-h-screen lg:grid lg:grid-cols-[var(--sidebar-width)_1fr]"
      aria-busy="true"
      aria-label="Loading"
    >
      <aside
        className="hidden border-r border-sidebar-border bg-sidebar-bg lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col"
        aria-hidden
      >
        <div className="flex h-(--header-height) shrink-0 items-center px-5">
          <div className="h-7 w-28 animate-pulse rounded-md bg-sidebar-bg-elevated" />
        </div>
        <div className="flex-1 space-y-1.5 p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-9 animate-pulse rounded-md bg-sidebar-bg-elevated"
            />
          ))}
        </div>
      </aside>

      <header
        className="sticky top-0 z-30 flex h-14 items-center border-b border-sidebar-border bg-sidebar-bg px-4 lg:hidden"
        aria-hidden
      >
        <div className="h-6 w-24 animate-pulse rounded-md bg-sidebar-bg-elevated" />
      </header>

      <div className="flex min-w-0 flex-col">
        <header
          className="sticky top-0 z-20 hidden h-(--header-height) items-center justify-end border-b border-line bg-surface px-8 lg:flex"
          aria-hidden
        >
          <Skeleton className="h-8 w-8 rounded-full" />
        </header>

        <main className="mx-auto w-full max-w-(--content-max-width) flex-1 space-y-4 px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-40 rounded-card" />
        </main>
      </div>
    </div>
  );
}
