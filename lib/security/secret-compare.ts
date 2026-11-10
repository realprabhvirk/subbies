import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time check of a presented secret against the expected one.
 *
 * Both sides are hashed first, so the comparison is always over 32 bytes and
 * neither the content nor the length of the real secret leaks through timing.
 * An unset or empty expected secret never matches anything.
 */
export function secretMatches(presented: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(presented ?? "").digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** The `Authorization: Bearer <CRON_SECRET>` check used by cron and health routes. */
export function hasCronSecret(authorizationHeader: string | null, cronSecret: string | undefined = process.env.CRON_SECRET): boolean {
  if (!cronSecret) return false;
  return secretMatches(authorizationHeader, `Bearer ${cronSecret}`);
}
