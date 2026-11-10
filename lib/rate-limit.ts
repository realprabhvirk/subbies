import "server-only";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashRateLimitKey, RATE_LIMIT_PURGE_AGE_SECONDS } from "@/lib/rate-limit-key";

/**
 * Per-key rate limiting for the public, server-side endpoints (the contact
 * form and the contractor upload actions). Backed by Supabase (migration
 * 0017), so it works across serverless instances without a new vendor.
 *
 * Not used for signup / login / password reset: those call Supabase Auth
 * directly from the browser, so the app never sees the request — Supabase's
 * own auth rate limits cover them (set in the dashboard).
 *
 * FAILS OPEN. If the limiter errors (table missing, Postgres blip), the action
 * is allowed and the error is logged. A broken limiter must never lock real
 * contractors out of uploading their documents; the worst case is that during
 * an outage the limit isn't enforced, which is exactly today's behaviour.
 */

export interface RateLimitRule {
  bucket: string;
  /** Max hits allowed within the window. */
  limit: number;
  windowSeconds: number;
}

/** Sensible windows. Generous enough not to catch real shared-network users. */
export const RATE_LIMITS = {
  // A contractor on site might legitimately open the link and request several
  // upload URLs in a burst (one per file, multiple documents), so this is
  // high and per-token.
  onboardAction: { bucket: "onboard_action", limit: 60, windowSeconds: 60 },
  // The contact form: a human sends one message, not twenty.
  contact: { bucket: "contact", limit: 5, windowSeconds: 600 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * The caller's IP, best-effort, from the proxy headers Vercel sets. Falls back
 * to a shared constant so a missing header degrades to "one global bucket"
 * rather than throwing — still some protection, and it fails open anyway.
 */
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    const real = h.get("x-real-ip");
    if (real) return real.trim();
  } catch {
    // headers() unavailable — fall through.
  }
  return "unknown";
}

/** @returns true when the action is allowed, false when over the limit. */
export async function checkRateLimit(rule: RateLimitRule, key: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_bucket: rule.bucket,
      // Hashed (L5): raw keys are upload tokens and IP addresses.
      p_key: hashRateLimitKey(rule.bucket, key),
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) {
      console.error("checkRateLimit: limiter unavailable, allowing", {
        bucket: rule.bucket,
        code: error.code,
        message: error.message,
      });
      return true; // fail open
    }
    return data !== false;
  } catch (err) {
    console.error("checkRateLimit: unexpected error, allowing", err);
    return true; // fail open
  }
}

/**
 * Deletes limiter rows older than a day (L5). Keys that never come back were
 * otherwise kept forever. Run from the daily cron; never throws.
 */
export async function purgeRateLimitHits(): Promise<number | null> {
  try {
    const { data, error } = await createAdminClient().rpc("purge_rate_limit_hits", {
      p_older_than_seconds: RATE_LIMIT_PURGE_AGE_SECONDS,
    });
    if (error) {
      console.error("purgeRateLimitHits failed", { code: error.code, message: error.message });
      return null;
    }
    return typeof data === "number" ? data : 0;
  } catch (err) {
    console.error("purgeRateLimitHits: unexpected error", err);
    return null;
  }
}

export const TOO_MANY_REQUESTS_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";
