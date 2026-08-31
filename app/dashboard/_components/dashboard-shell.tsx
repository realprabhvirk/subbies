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
  type LucideIcon,
} from "lucide-react";

import type { AppNotification } from "@/lib/types";
import { Logo } from "@/app/components/logo";
import { Spinner } from "@/app/components/spinner";
import { SignOutButton } from "./sign-out-button";
import { NotificationsBell } from "./notifications-bell";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/contractors", label: "Contractors", icon: Users },
  { href: "/dashboard/projects", label: "Projects", icon: FolderKanban },
  { href: "/dashboard/document-types", label: "Document types", icon: FileText },
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
      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-brand-tint font-semibold text-brand-active"
          : "font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
      }`}
    >
      <NavIcon Icon={item.icon} />
      {item.label}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
      {children}
    </p>
  );
}

export function DashboardShell({
  companyName,
  notifications,
  unreadCount,
  children,
}: {
  companyName: string;
  notifications: AppNotification[];
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (onNavigate?: () => void) => (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      <SectionLabel>Main menu</SectionLabel>
      {NAV.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={isActive(pathname, item)}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );

  const account = (
    <div className="border-t border-line p-3">
      <p className="truncate px-3 pb-1.5 text-xs text-ink-subtle">
        {companyName}
      </p>
      <SignOutButton />
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15.5rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-line bg-surface lg:flex lg:flex-col">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        {nav()}
        {account}
      </aside>

      {/* Mobile header */}
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 lg:hidden">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationsBell
            notifications={notifications}
            unreadCount={unreadCount}
          />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-2 text-ink-muted hover:bg-surface-muted"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-warm-900/40 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-surface shadow-lg">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-2 text-ink-muted hover:bg-surface-muted"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            {nav(() => setMobileOpen(false))}
            {account}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="hidden h-16 items-center justify-end border-b border-line bg-surface px-6 lg:flex">
          <NotificationsBell
            notifications={notifications}
            unreadCount={unreadCount}
          />
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
