/**
 * "just now", "5m ago", "3h ago", "2d ago". Shared by the notification bell and
 * the dashboard's recent activity so the two can't drift. Pure; `now` is
 * injectable for tests.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
