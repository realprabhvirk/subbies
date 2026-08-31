"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import type { AppNotification } from "@/lib/types";
import { markNotificationsRead } from "../actions";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

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
        className="relative rounded-md p-2 text-ink-muted transition-colors hover:bg-surface-muted"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
      >
        <Bell className="h-5 w-5" strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-expired px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-line bg-surface shadow-sm shadow-lg">
          <div className="border-b border-line px-4 py-2.5 text-sm font-semibold">
            Notifications
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">
              Nothing yet. You&apos;ll be notified when a contractor submits a
              document.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {notifications.map((n) => {
                const body = (
                  <>
                    <p className="text-sm">{n.message}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle">
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
