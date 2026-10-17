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
        className="hidden bg-sidebar-bg lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col"
        aria-hidden
      >
        <div className="flex h-(--header-height) shrink-0 items-center border-b border-sidebar-border px-5">
          <div className="h-6 w-28 animate-pulse rounded-sm bg-sidebar-bg-elevated" />
        </div>
        <div className="flex-1 space-y-0.5 px-3 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-md bg-sidebar-bg-elevated motion-reduce:animate-none"
            />
          ))}
        </div>
      </aside>

      <header
        className="sticky top-0 z-30 flex h-14 items-center bg-sidebar-bg px-4 lg:hidden"
        aria-hidden
      >
        <div className="h-6 w-24 animate-pulse rounded-md bg-sidebar-bg-elevated" />
      </header>

      <div className="flex min-w-0 flex-col">
        <header
          className="sticky top-0 z-20 hidden h-(--header-height) items-center justify-between border-b border-line bg-surface px-10 lg:flex"
          aria-hidden
        >
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-8" />
        </header>

        <main className="mx-auto w-full max-w-(--content-max-width) flex-1 space-y-6 px-4 pb-16 pt-8 sm:px-6 lg:px-10 lg:pt-10">
          <div className="space-y-3 border-b border-line pb-6">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-40" />
        </main>
      </div>
    </div>
  );
}
