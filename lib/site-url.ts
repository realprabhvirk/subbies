/**
 * The app's public base URL, for links that have to be absolute.
 *
 * Safe to import from client components, unlike lib/app-url.ts, which is
 * server-only because it reads request headers.
 *
 * Prefers NEXT_PUBLIC_APP_URL — the same variable lib/app-url.ts uses on the
 * server, so there is one canonical host setting rather than two that can
 * drift apart. Falls back to the origin the browser is currently on, which is
 * the right answer for local dev and for preview deployments where the
 * variable isn't set.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
