"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import type { AppNotification } from "@/lib/types";
import { relativeTime } from "@/lib/relative-time";
import { markNotificationsRead } from "../actions";

export function NotificationsBell({
  notifications,
  unreadCount,
}: {
  notifications: AppNotification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      startTransition(async () => {
        await markNotificationsRead();
        router.refresh();
      });
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        // Inherits its colour from whichever header it sits in — the light
        // desktop bar or the navy mobile one — and tints its own hover from
        // that colour, so one bell works on both surfaces.
        className="pressable relative flex h-12 w-12 items-center justify-center rounded-full text-current hover:bg-current/10"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
      >
        <Bell className="h-6 w-6" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-expired px-1 font-mono text-2xs font-medium leading-none text-white ring-2 ring-surface in-data-[surface=sidebar]:ring-sidebar-bg">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] origin-top-right overflow-hidden rounded-card border border-line bg-surface text-ink shadow-lg">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="label-caps text-ink-muted">Notifications</p>
          </div>
          {notifications.length === 0 ? (
            <p className="px-5 py-8 text-sm text-ink-muted">
              Nothing yet. You&apos;ll be notified when a contractor submits a
              document.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {notifications.map((n) => {
                const body = (
                  <>
                    <p className="text-sm text-ink">{n.message}</p>
                    <p className="mt-1 font-mono text-2xs text-ink-subtle">
                      {relativeTime(n.created_at)}
                    </p>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.contractor_id ? (
                      <Link
                        href={`/dashboard/contractors/${n.contractor_id}`}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3 transition-colors hover:bg-surface-muted"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
