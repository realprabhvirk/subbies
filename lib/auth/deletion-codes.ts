import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  CODE_TTL_MINUTES,
  MAX_ATTEMPTS,
  hashDeletionCode,
  generateCode,
  evaluateDeletionCode,
  type DeletionCodeRecord,
  type DeletionCodeCheck,
} from "./deletion-code-logic";

export { MAX_ATTEMPTS, hashDeletionCode, type DeletionCodeCheck };

/**
 * Email-verified account deletion codes — the database-touching half. The
 * accept/reject decision itself lives in deletion-code-logic.ts (pure, unit
 * tested there); this file is the service-role I/O around it: one pending
 * code per user, a fresh request overwrites whatever code came before it.
 */

export const RESEND_COOLDOWN_SECONDS = 60;

export type RequestCodeResult =
  | { ok: true; code: string }
  | { ok: false; reason: "cooldown"; retryAfterSeconds: number };

/**
 * Issues a new 6-digit code for `userId`, overwriting any pending one.
 * Returns the raw code exactly once — nothing else in this module ever hands
 * it back out, so the caller (deletion-actions.ts) must email it immediately
 * and never log or return it anywhere else.
 */
export async function requestDeletionCode(userId: string): Promise<RequestCodeResult> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("account_deletion_codes")
    .select("last_sent_at")
    .eq("user_id", userId)
    .maybeSingle<{ last_sent_at: string }>();

  if (existing) {
    const elapsedMs = Date.now() - new Date(existing.last_sent_at).getTime();
    const remainingMs = RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs;
    if (remainingMs > 0) {
      return {
        ok: false,
        reason: "cooldown",
        retryAfterSeconds: Math.ceil(remainingMs / 1000),
      };
    }
  }

  const code = generateCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000);

  const { error } = await admin.from("account_deletion_codes").upsert(
    {
      user_id: userId,
      code_hash: hashDeletionCode(code),
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      last_sent_at: now.toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("requestDeletionCode: upsert failed", error);
    throw error;
  }

  return { ok: true, code };
}

/**
 * Verifies a submitted code, using up one attempt first.
 *
 * M4: this used to read the attempt count, compare, then write count + 1, so
 * 50 guesses sent at once all read the same count and all got checked. Now
 * consume_deletion_code_attempt (migration 0020) takes the attempt and returns
 * the code in one UPDATE ... RETURNING: once MAX_ATTEMPTS are used, every
 * further guess gets nothing to compare against, however many arrive at once.
 * Fails closed: this gates deleting an account.
 */
export async function verifyDeletionCode(
  userId: string,
  submittedCode: string,
): Promise<DeletionCodeCheck> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .rpc("consume_deletion_code_attempt", { p_user_id: userId, p_max_attempts: MAX_ATTEMPTS })
    .maybeSingle<{ code_hash: string; expires_at: string; attempts: number }>();

  if (error) {
    console.error("verifyDeletionCode: couldn't take an attempt", { code: error.code, message: error.message });
    return { ok: false, reason: "too_many_attempts" };
  }

  if (!data) {
    // No attempt was taken: either there's no code, or it's used up.
    const { data: existing } = await admin
      .from("account_deletion_codes")
      .select("attempts")
      .eq("user_id", userId)
      .maybeSingle<{ attempts: number }>();
    return { ok: false, reason: existing ? "too_many_attempts" : "no_code" };
  }

  // `attempts` already includes this one; the check wants the count before it.
  const record: DeletionCodeRecord = {
    codeHash: data.code_hash,
    expiresAt: data.expires_at,
    attempts: data.attempts - 1,
  };
  return evaluateDeletionCode(record, submittedCode);
}

/** Best-effort cleanup. Also happens automatically via cascade once the auth user is deleted. */
export async function clearDeletionCode(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("account_deletion_codes").delete().eq("user_id", userId);
}
