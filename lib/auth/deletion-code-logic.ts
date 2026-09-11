/**
 * Pure logic for account-deletion codes — no database, no "server-only".
 *
 * Split out of lib/auth/deletion-codes.ts specifically so it can be unit
 * tested with plain `node --test`: deletion-codes.ts imports "server-only"
 * (it touches the service-role client, which really must never reach a
 * client bundle), and the "server-only" package only resolves inside
 * Next.js's own webpack build — it throws MODULE_NOT_FOUND under a bare
 * Node process, which is exactly how the test runner executes this repo's
 * tests. This file has no such dependency, so it can be imported directly by
 * deletion-code-logic.test.ts.
 */

import crypto from "node:crypto";

export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;

export function hashDeletionCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function generateCode(): string {
  // crypto.randomInt, not Math.random() — this gates a destructive action,
  // so the code needs to be unpredictable, not just look like one.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export interface DeletionCodeRecord {
  codeHash: string;
  expiresAt: string; // ISO
  attempts: number;
}

export type DeletionCodeCheck =
  | { ok: true }
  | { ok: false; reason: "no_code" | "expired" | "too_many_attempts" | "incorrect" };

/**
 * The actual accept/reject decision for a submitted deletion code. Hashed at
 * rest with plain SHA-256, deliberately not bcrypt/argon2: those defend a
 * hash an attacker has stolen and can guess against offline, forever. This
 * code is 6 digits, expires in CODE_TTL_MINUTES, and locks out after
 * MAX_ATTEMPTS wrong guesses — all enforced before the hash comparison ever
 * runs — so the thing being defended is "don't store the code as plaintext,"
 * not "survive unlimited offline guessing." A slow hash would buy nothing.
 */
export function evaluateDeletionCode(
  record: DeletionCodeRecord | null,
  submittedCode: string,
  now: Date = new Date(),
): DeletionCodeCheck {
  if (!record) return { ok: false, reason: "no_code" };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };
  if (new Date(record.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  if (hashDeletionCode(submittedCode) !== record.codeHash) {
    return { ok: false, reason: "incorrect" };
  }
  return { ok: true };
}
