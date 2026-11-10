import { createHash } from "node:crypto";

/**
 * What the rate limiter stores as a row's key (L5). The raw keys include
 * contractor upload tokens and IP addresses; a hash of bucket + key keeps
 * them out of the table while still grouping the same caller together.
 */
export function hashRateLimitKey(bucket: string, key: string): string {
  return createHash("sha256").update(`${bucket}:${key}`).digest("hex");
}

/** Hits older than this are purged daily. Well past the longest window. */
export const RATE_LIMIT_PURGE_AGE_SECONDS = 24 * 60 * 60;
