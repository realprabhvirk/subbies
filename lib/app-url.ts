import "server-only";

import { headers } from "next/headers";

/**
 * The absolute base URL of this deployment, used to build links that go into
 * emails (so they must be absolute and correct per environment).
 *
 * Priority:
 *   1. NEXT_PUBLIC_APP_URL — set this in production to a stable canonical URL.
 *   2. The incoming request's forwarded host (works on Vercel previews).
 *   3. localhost fallback for dev.
 */
export async function getAppUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? "https";
      return `${proto}://${host}`;
    }
  } catch {
    // headers() unavailable outside a request — fall through
  }

  return "http://localhost:3000";
}
