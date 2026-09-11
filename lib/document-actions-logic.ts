import type { DocumentStatus } from "@/lib/types";

/**
 * Pure gating rules for the per-document company-side actions (revoke,
 * resend, edit expiry) and the contractor-side submission flow. Each rule
 * exists in exactly one place and is shared by both the UI (so a button
 * that can't succeed isn't shown) and the server action (so the real
 * decision is never made by a client that could be wrong or tampered with)
 * — the two were two independent copies of the same conditions before this,
 * which only takes one of them changing without the other to drift.
 *
 * No I/O in this file on purpose: it needs to import cleanly under plain
 * `node --test`, which `server-only`-marked modules cannot.
 */

/** Cancel a request before the contractor has responded to it. */
export function canRevoke(status: DocumentStatus): boolean {
  return status === "requested";
}

/** Re-send the request email — only meaningful while something is actually outstanding. */
export function canResendRequest(status: DocumentStatus): boolean {
  return status === "requested" || status === "rejected";
}

/** Correct the recorded expiry date on a document that's already been approved. */
export function canEditApprovedExpiry(status: DocumentStatus): boolean {
  return status === "approved";
}

/**
 * Whether the contractor can (re-)submit files for this requirement.
 * Includes "uploaded" deliberately — replacing a file before the company
 * has reviewed it is a real, long-standing capability of this flow.
 */
export function canSubmitDocument(status: DocumentStatus): boolean {
  return status === "requested" || status === "rejected" || status === "uploaded";
}

export interface ExpiryValidation {
  ok: boolean;
  error?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function maxFutureFrom(now: Date): Date {
  const max = new Date(now);
  max.setFullYear(max.getFullYear() + 15);
  return max;
}

/**
 * Validates an expiry date being set at approval time: must be a real date,
 * no more than 15 years out, and not in the past — you can't approve a
 * document as already expired.
 */
export function isValidApprovalExpiry(dateStr: string, now: Date = new Date()): ExpiryValidation {
  if (!DATE_RE.test(dateStr)) return { ok: false, error: "Enter a valid date." };
  const date = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Enter a valid date." };

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (date.getTime() < today.getTime()) {
    return { ok: false, error: "Enter an expiry date between today and 15 years out." };
  }
  if (date.getTime() > maxFutureFrom(today).getTime()) {
    return { ok: false, error: "Enter an expiry date between today and 15 years out." };
  }
  return { ok: true };
}

/**
 * Validates an expiry date being corrected on an already-approved document.
 * Deliberately has no lower bound: the whole point of editing is to fix the
 * recorded date to match reality, and reality can be a date already in the
 * past (that's precisely the "oops, this actually already expired" case) —
 * unlike approving, which can't state a document expires in the past.
 */
export function isValidCorrectedExpiry(dateStr: string, now: Date = new Date()): ExpiryValidation {
  if (!DATE_RE.test(dateStr)) return { ok: false, error: "Enter a valid date." };
  const date = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(date.getTime())) return { ok: false, error: "Enter a valid date." };

  if (date.getTime() > maxFutureFrom(now).getTime()) {
    return { ok: false, error: "That date is too far in the future." };
  }
  return { ok: true };
}

export interface StagedFileInput {
  name: string;
  type: string;
  size: number;
}

export interface StagedBatchValidation {
  ok: boolean;
  error?: string;
}

const MAX_FILES_PER_SUBMISSION = 10;

/**
 * Validates a batch of files the contractor has staged before they're ever
 * uploaded — same accepted-type and size-limit rules `requestDocumentUpload`
 * enforces per file server-side, checked up front so a doomed upload never
 * starts, plus a batch-size ceiling matching what submitStagedDocuments will
 * accept.
 */
export function validateStagedBatch(
  files: StagedFileInput[],
  opts: { isAllowedMimeType: (type: string) => boolean; maxBytes: number },
): StagedBatchValidation {
  if (files.length === 0) return { ok: true };
  if (files.length > MAX_FILES_PER_SUBMISSION) {
    return { ok: false, error: `Submit up to ${MAX_FILES_PER_SUBMISSION} files at a time.` };
  }
  if (files.some((f) => !opts.isAllowedMimeType(f.type || ""))) {
    return { ok: false, error: "Upload a PDF, JPG, PNG, or HEIC file." };
  }
  if (files.some((f) => f.size > opts.maxBytes)) {
    return { ok: false, error: "That file is over the 15 MB limit." };
  }
  return { ok: true };
}

export { MAX_FILES_PER_SUBMISSION };
