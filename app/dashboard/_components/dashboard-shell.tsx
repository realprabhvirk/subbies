"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

import type { AppNotification } from "@/lib/types";
import { Logo } from "@/app/components/logo";
import { SignOutButton } from "./sign-out-button";
import { NotificationsBell } from "./notifications-bell";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match this exact path only (used for the index route). */
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/contractors", label: "Contractors", icon: Users },
  { href: "/dashboard/document-types", label: "Document types", icon: FileText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
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

  const navLinks = (onNavigate?: () => void) =>
    NAV.map((item) => {
      const Icon = item.icon;
      const active = isActive(pathname, item);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            active
              ? "bg-brand-tint text-brand-ink"
              : "text-ink-muted hover:bg-surface-muted hover:text-ink"
          }`}
        >
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
          {item.label}
        </Link>
      );
    });

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-line bg-surface lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-line px-5">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">{navLinks()}</nav>
        <div className="border-t border-line p-3">
          <p className="truncate px-3 pb-1 text-xs text-ink-subtle">
            {companyName}
          </p>
          <SignOutButton />
        </div>
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
            className="absolute inset-0 bg-brand-ink/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-surface shadow-xl">
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
            <nav className="flex flex-1 flex-col gap-1 p-3">
              {navLinks(() => setMobileOpen(false))}
            </nav>
            <div className="border-t border-line p-3">
              <p className="truncate px-3 pb-1 text-xs text-ink-subtle">
                {companyName}
              </p>
              <SignOutButton />
            </div>
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
