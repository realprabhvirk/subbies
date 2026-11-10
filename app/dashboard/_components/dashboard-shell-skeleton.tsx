import { Skeleton } from "@/app/components/skeleton";

/**
 * Stand-in for the whole DashboardShell (sidebar + header + content), shown
 * while dashboard-gate.tsx's auth/company/entitlement check is in flight.
 *
 * Mirrors DashboardShell's geometry exactly: the same grid and breakpoint, the
 * same --sidebar-width / --header-height / --page-padding tokens, 56px nav
 * rows, the profile block pinned to the bottom of the rail, and the desktop
 * top bar with its bell, company chip and avatar. Nothing moves when the real
 * shell streams in; the rail and bar are already the right size, just empty.
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
        <div className="flex h-(--header-height) shrink-0 items-center border-b border-sidebar-border px-6">
          <div className="h-9 w-36 animate-pulse rounded-md bg-sidebar-bg-elevated motion-reduce:animate-none" />
        </div>
        <div className="flex-1 px-4 py-5">
          <div className="space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-md bg-sidebar-bg-elevated motion-reduce:animate-none"
              />
            ))}
          </div>
          <div className="my-5 border-t border-sidebar-border" />
          <div className="h-14 animate-pulse rounded-md bg-sidebar-bg-elevated motion-reduce:animate-none" />
        </div>
        <div className="shrink-0 border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3 px-1 pb-3 pt-1">
            <div className="h-11 w-11 animate-pulse rounded-full bg-sidebar-bg-elevated motion-reduce:animate-none" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded-md bg-sidebar-bg-elevated motion-reduce:animate-none" />
              <div className="h-3 w-40 animate-pulse rounded-md bg-sidebar-bg-elevated motion-reduce:animate-none" />
            </div>
          </div>
          <div className="h-12 animate-pulse rounded-md bg-sidebar-bg-elevated motion-reduce:animate-none" />
        </div>
      </aside>

      <header
        className="sticky top-0 z-30 flex h-16 items-center bg-sidebar-bg px-5 lg:hidden"
        aria-hidden
      >
        <div className="h-8 w-32 animate-pulse rounded-md bg-sidebar-bg-elevated motion-reduce:animate-none" />
      </header>

      <div className="flex min-w-0 flex-col">
        <header
          className="sticky top-0 z-20 hidden h-(--header-height) items-center justify-between border-b border-line bg-canvas px-8 lg:flex"
          aria-hidden
        >
          <Skeleton className="h-5 w-56" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-12 w-56" />
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-(--content-max-width) flex-1 space-y-8 px-(--page-padding) pb-16 pt-8 lg:pt-10">
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-14 w-80 max-w-full" />
            <Skeleton className="h-5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-48 rounded-card" />
        </main>
      </div>
    </div>
  );
}
