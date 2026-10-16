/**
 * One password rule, used by every form that sets a password — signup,
 * password reset, and change-password — so the UI, the three forms, and the
 * error messages can't drift apart (they previously all said "8" while the
 * server allowed 6).
 *
 * Deliberately light: a length floor plus a block on the handful of passwords
 * that show up at the top of every breach corpus. It is NOT a strength meter
 * and NOT the last line of defence — Supabase's own password policy (minimum
 * length and leaked-password protection, set in the dashboard) is the
 * server-side enforcement. This just stops the obviously-bad ones early with a
 * clear message.
 *
 * Pure and dependency-free so it runs under `node --test` and in the browser.
 */

export const MIN_PASSWORD_LENGTH = 10;

/**
 * Lowercased passwords that are never acceptable regardless of length. Short
 * on purpose — the length floor already rejects most weak inputs; this catches
 * the long-but-obvious ones ("password123", "qwertyuiop", …).
 */
const BLOCKLIST = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "passw0rd",
  "qwertyuiop",
  "1234567890",
  "12345678910",
  "letmein123",
  "iloveyou123",
  "admin12345",
  "welcome123",
  "changeme123",
  "subbies123",
]);

export interface PasswordCheck {
  ok: boolean;
  error?: string;
}

export function validatePassword(password: string): PasswordCheck {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (BLOCKLIST.has(password.toLowerCase())) {
    return { ok: false, error: "That password is too common. Pick something harder to guess." };
  }
  // A single repeated character ("aaaaaaaaaa") clears the length floor but is
  // trivially guessable.
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, error: "Pick something harder to guess." };
  }
  return { ok: true };
}
