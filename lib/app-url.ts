import "server-only";

import { headers } from "next/headers";

import { resolveAppUrl } from "@/lib/app-url-logic";

/**
 * The absolute base URL of this deployment, used to build links that go into
 * emails (so they must be absolute and correct per environment).
 *
 * NEXT_PUBLIC_APP_URL is required in production (Production AND Preview on
 * Vercel, both run with NODE_ENV=production) and this throws without it.
 * Request headers are only consulted in local development, and only for a
 * localhost Host. See lib/app-url-logic.ts.
 */
export async function getAppUrl(): Promise<string> {
  let host: string | null = null;
  if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_APP_URL) {
    try {
      host = (await headers()).get("host");
    } catch {
      // headers() unavailable outside a request
    }
  }
  return resolveAppUrl({
    configured: process.env.NEXT_PUBLIC_APP_URL,
    nodeEnv: process.env.NODE_ENV,
    host,
  });
}
