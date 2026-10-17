"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  Settings,
  Menu,
  X,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

import { Logo } from "@/app/components/logo";
import { Spinner } from "@/app/components/spinner";
import { Avatar } from "@/app/components/avatar";
import { SignOutButton } from "./sign-out-button";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

/**
 * Only routes that actually exist. The dashboard mockup showed extra rails
 * (Documents, Reminders, Reports) that have no pages behind them — shipping
 * those as nav items would just be five links to a 404.
 */
const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/contractors", label: "Contractors", icon: Users },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/document-types", label: "Document types", icon: FileText },
];

const ACCOUNT_NAV: NavItem[] = [
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function NavIcon({ Icon }: { Icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <Spinner className="h-4 w-4" />
  ) : (
    <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      // The active item is marked twice — a raised fill and a light bar on
      // its left edge — so it reads at a glance on the dark rail.
      className={`relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-[var(--duration-fast)] ${
        active
          ? "bg-sidebar-active-bg font-semibold text-sidebar-ink before:absolute before:inset-y-2.5 before:-left-3 before:w-0.75 before:rounded-r-full before:bg-sidebar-ink"
          : "font-medium text-sidebar-ink-muted hover:bg-sidebar-bg-elevated hover:text-sidebar-ink"
      }`}
    >
      <NavIcon Icon={item.icon} />
      {item.label}
    </Link>
  );
}

function trialDaysLeft(iso: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000),
  );
}

export function DashboardShell({
  companyName,
  userEmail,
  notificationsSlot,
  trialEndsAt,
  planName,
  children,
}: {
  companyName: string;
  userEmail: string | null;
  /** Server-rendered bell, streamed in its own Suspense boundary. */
  notificationsSlot: React.ReactNode;
  /** Set only while the company is inside its plan's free trial. */
  trialEndsAt: string | null;
  planName: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const daysLeft = trialEndsAt ? trialDaysLeft(trialEndsAt) : null;
  const section = [...MAIN_NAV, ...ACCOUNT_NAV].find((item) =>
    isActive(pathname, item),
  );

  /**
   * One sidebar body, rendered twice — fixed rail on desktop, drawer on
   * mobile. Same markup and same tokens both times, so the rail can't drift
   * from the drawer as either one gets edited.
   */
  const sidebarBody = (onNavigate?: () => void) => (
    <>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
        <div className="flex flex-col gap-0.5">
          {MAIN_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item)}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <div className="my-4 border-t border-sidebar-border" />

        <div className="flex flex-col gap-0.5">
          {ACCOUNT_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-2 pb-3 pt-1">
          <Avatar name={companyName} tone="navy" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-ink">
              {companyName}
            </p>
            {userEmail && (
              <p className="truncate text-xs text-sidebar-ink-muted">
                {userEmail}
              </p>
            )}
          </div>
        </div>
        <SignOutButton variant="sidebar" />
      </div>
    </>
  );

  /**
   * The trial strip. A trial is not a problem, so it sits calm and neutral —
   * plan, countdown, link — and only takes the attention colour on the last
   * day, when the card is about to be charged.
   */
  const trialStrip =
    trialEndsAt && daysLeft !== null ? (
      <Link
        href="/dashboard/settings?tab=billing"
        className={`group flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 border-b px-4 py-2 text-xs transition-colors sm:text-sm lg:justify-start lg:px-10 ${
          daysLeft === 0
            ? "border-attention-line bg-attention-bg text-attention"
            : "border-line bg-surface-muted text-ink-muted hover:text-ink"
        }`}
      >
        <span>
          <span className="font-semibold">
            {planName ? `${planName} trial` : "Free trial"}
          </span>
          <span aria-hidden className="mx-2 opacity-50">
            /
          </span>
          {daysLeft === 0
            ? "Ends today: your card is charged next"
            : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`}
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-brand group-hover:underline">
          Manage billing
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        </span>
      </Link>
    ) : null;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[var(--sidebar-width)_1fr]">
      {/* Desktop rail */}
      <aside
        data-surface="sidebar"
        className="hidden bg-sidebar-bg lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col"
      >
        <div className="flex h-(--header-height) shrink-0 items-center border-b border-sidebar-border px-5">
          <Link href="/dashboard" aria-label="Subbies home" className="rounded-sm">
            <Logo tone="inverse" height={26} priority />
          </Link>
        </div>
        {sidebarBody()}
      </aside>

      {/* Mobile header */}
      <header
        data-surface="sidebar"
        className="sticky top-0 z-30 flex h-14 items-center justify-between bg-sidebar-bg pl-4 pr-1.5 lg:hidden"
      >
        <Link href="/dashboard" aria-label="Subbies home" className="rounded-sm">
          <Logo tone="inverse" height={24} priority />
        </Link>
        <div className="flex items-center text-sidebar-ink-muted">
          {notificationsSlot}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-md text-sidebar-ink-muted transition-colors hover:bg-sidebar-bg-elevated hover:text-sidebar-ink"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Mobile drawer — the same rail, same tokens */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="dialog-backdrop absolute inset-0 bg-warm-900/55"
            onClick={() => setMobileOpen(false)}
          />
          <div
            data-surface="sidebar"
            className="drawer-panel absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-sidebar-bg shadow-xl"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border pl-4 pr-1.5">
              <Logo tone="inverse" height={24} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-md text-sidebar-ink-muted transition-colors hover:bg-sidebar-bg-elevated hover:text-sidebar-ink"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            {sidebarBody(() => setMobileOpen(false))}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        {/* Desktop top bar: where you are (company / section) and
            notifications. No search field: the app has no search to run,
            and a box that does nothing is worse than no box. */}
        <header className="sticky top-0 z-20 hidden h-(--header-height) items-center justify-between gap-4 border-b border-line bg-surface/95 px-10 text-ink-muted backdrop-blur-sm lg:flex">
          <p className="flex min-w-0 items-center gap-2 text-sm">
            <span className="truncate font-medium text-ink-muted">{companyName}</span>
            {section && (
              <>
                <span aria-hidden className="text-line-strong">
                  /
                </span>
                <span className="font-semibold text-ink">{section.label}</span>
              </>
            )}
          </p>
          {notificationsSlot}
        </header>

        {trialStrip}

        <main className="mx-auto w-full max-w-(--content-max-width) flex-1 px-4 pb-16 pt-8 sm:px-6 lg:px-10 lg:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
