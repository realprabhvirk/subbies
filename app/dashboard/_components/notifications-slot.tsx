import { cache } from "react";
import { Bell } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCompany } from "@/lib/supabase/dal";
import type { AppNotification } from "@/lib/types";
import { NotificationsBell } from "./notifications-bell";

/**
 * The notification bell's data, fetched outside the layout's blocking path.
 *
 * Notifications gate nothing — they are bell content — but fetching them in
 * the layout meant the sidebar and header could not paint until they came
 * back. Rendered inside a Suspense boundary instead, the shell appears as
 * soon as the access check clears and this fills in behind it.
 *
 * `cache` matters here: the shell renders the bell twice (mobile and desktop
 * headers), and without it that would be two identical round trips.
 */
const loadNotifications = cache(
  async (): Promise<{ notifications: AppNotification[]; unreadCount: number }> => {
    const company = await getCompany();
    if (!company) return { notifications: [], unreadCount: 0 };

    const supabase = await createClient();
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, company_id, contractor_id, type, message, read_at, created_at")
        .eq("company_id", company.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("company_id", company.id)
        .is("read_at", null),
    ]);

    return {
      notifications: (data ?? []) as AppNotification[],
      unreadCount: count ?? 0,
    };
  },
);

/** Bell shape shown while the count is still loading, so the header doesn't shift. */
export function NotificationsBellFallback() {
  return (
    <span
      className="relative rounded-md p-2 text-ink-subtle"
      aria-hidden
    >
      <Bell className="h-5 w-5" strokeWidth={2} />
    </span>
  );
}

export async function NotificationsSlot() {
  const { notifications, unreadCount } = await loadNotifications();
  return (
    <NotificationsBell notifications={notifications} unreadCount={unreadCount} />
  );
}
