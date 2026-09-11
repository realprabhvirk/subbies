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

/** Verifies a submitted code against the stored record and counts the attempt either way. */
export async function verifyDeletionCode(
  userId: string,
  submittedCode: string,
): Promise<DeletionCodeCheck> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("account_deletion_codes")
    .select("code_hash, expires_at, attempts")
    .eq("user_id", userId)
    .maybeSingle<{ code_hash: string; expires_at: string; attempts: number }>();

  const record: DeletionCodeRecord | null = data
    ? { codeHash: data.code_hash, expiresAt: data.expires_at, attempts: data.attempts }
    : null;

  const result = evaluateDeletionCode(record, submittedCode);

  // Bump the attempt count regardless of outcome, so a wrong guess moves the
  // code closer to locked-out. The row is deleted immediately after a
  // successful deletion anyway (cascade off the auth user), so bumping it on
  // a correct guess is only a safety net for the case where verification
  // succeeds but the caller doesn't follow through with the deletion.
  if (record) {
    await admin
      .from("account_deletion_codes")
      .update({ attempts: record.attempts + 1 })
      .eq("user_id", userId);
  }

  return result;
}

/** Best-effort cleanup. Also happens automatically via cascade once the auth user is deleted. */
export async function clearDeletionCode(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("account_deletion_codes").delete().eq("user_id", userId);
}
