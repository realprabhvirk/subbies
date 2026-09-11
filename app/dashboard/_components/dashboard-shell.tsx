"use client";

import { useState } from "react";
import Image from "next/image";
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
  type LucideIcon,
} from "lucide-react";

import { Logo } from "@/app/components/logo";
import { Spinner } from "@/app/components/spinner";
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
      className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors ${
        active
          ? "bg-sidebar-active-bg font-semibold text-sidebar-ink"
          : "font-medium text-sidebar-ink-muted hover:bg-sidebar-bg-elevated hover:text-sidebar-ink"
      }`}
    >
      <NavIcon Icon={item.icon} />
      {item.label}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-ink-subtle">
      {children}
    </p>
  );
}

function trialDaysLeft(iso: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000),
  );
}

/** Up to two initials from the company name, for the avatar tile. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "–";
  return (words[0][0] + (words[1]?.[0] ?? "")).toUpperCase();
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
  const initials = initialsOf(companyName);

  /**
   * One sidebar body, rendered twice — fixed rail on desktop, drawer on
   * mobile. Same markup and same tokens both times, so the rail can't drift
   * from the drawer as either one gets edited.
   */
  const sidebarBody = (onNavigate?: () => void) => (
    <>
      <nav className="flex-1 overflow-y-auto p-3">
        <SectionLabel>Main menu</SectionLabel>
        <div className="flex flex-col gap-1">
          {MAIN_NAV.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item)}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <div className="my-3 border-t border-sidebar-border" />

        <div className="flex flex-col gap-1">
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

      {/* Decorative brand panel. Desktop only — on a phone the drawer needs
          its height for navigation, not atmosphere. */}
      <div className="relative hidden h-28 shrink-0 overflow-hidden lg:block">
        <Image
          src="/brand/blueprint.jpg"
          alt=""
          fill
          sizes="248px"
          className="object-cover opacity-[0.14] grayscale"
        />
        <div className="absolute inset-0 flex flex-col justify-end p-5">
          <p className="text-[11px] font-semibold uppercase leading-relaxed tracking-[0.08em] text-sidebar-ink-muted">
            Safer sites
            <br />
            Stronger builds
          </p>
          <span className="mt-2 h-px w-8 bg-sidebar-ink-subtle" aria-hidden />
        </div>
      </div>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 px-1 pb-2">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-active-bg text-[11px] font-semibold text-sidebar-ink"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-ink">
              {companyName}
            </p>
            {userEmail && (
              <p className="truncate text-xs text-sidebar-ink-subtle">
                {userEmail}
              </p>
            )}
          </div>
        </div>
        <SignOutButton variant="sidebar" />
      </div>
    </>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[var(--sidebar-width)_1fr]">
      {/* Desktop rail */}
      <aside
        data-surface="sidebar"
        className="hidden border-r border-sidebar-border bg-sidebar-bg lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col"
      >
        <div className="flex h-(--header-height) shrink-0 items-center px-5">
          <Link href="/dashboard" aria-label="Subbies home">
            <Logo tone="inverse" height={30} showTagline priority />
          </Link>
        </div>
        {sidebarBody()}
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar-bg px-4 lg:hidden">
        <Link href="/dashboard" aria-label="Subbies home">
          <Logo tone="inverse" height={24} priority />
        </Link>
        <div className="flex items-center gap-1 text-sidebar-ink-muted">
          {notificationsSlot}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-sidebar-ink-muted transition-colors hover:bg-sidebar-bg-elevated hover:text-sidebar-ink"
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
            className="absolute inset-0 bg-warm-900/50 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div
            data-surface="sidebar"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-sidebar-bg shadow-lg"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
              <Logo tone="inverse" height={24} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 text-sidebar-ink-muted transition-colors hover:bg-sidebar-bg-elevated hover:text-sidebar-ink"
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
        {/* Desktop top bar. No search field: the app has no search to run, and
            a box that does nothing is worse than no box. */}
        <header className="sticky top-0 z-20 hidden h-(--header-height) items-center justify-end gap-3 border-b border-line bg-surface px-8 text-ink-muted lg:flex">
          {notificationsSlot}
          <div className="flex items-center gap-2.5 border-l border-line pl-3">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white"
            >
              {initials}
            </span>
            <div className="min-w-0 text-sm leading-tight">
              <p className="truncate font-medium text-ink">{companyName}</p>
              {userEmail && (
                <p className="truncate text-xs text-ink-subtle">{userEmail}</p>
              )}
            </div>
          </div>
        </header>

        {trialEndsAt && (
          <Link
            href="/dashboard/settings?tab=billing"
            className="flex flex-wrap items-center justify-center gap-x-1.5 border-b border-line bg-attention-bg px-4 py-2 text-center text-sm text-attention transition-colors hover:brightness-[0.98]"
          >
            <span>
              {trialDaysLeft(trialEndsAt) === 0
                ? `Your ${planName ? `${planName} ` : ""}trial ends today: your card is charged next`
                : `${trialDaysLeft(trialEndsAt)} ${
                    trialDaysLeft(trialEndsAt) === 1 ? "day" : "days"
                  } left of your free trial`}
            </span>
            <span className="font-semibold underline underline-offset-2">
              Manage billing
            </span>
          </Link>
        )}

        <main className="mx-auto w-full max-w-(--content-max-width) flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
