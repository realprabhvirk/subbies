import type { DocumentStatus } from "@/lib/types";

/**
 * Pure rules for the document lifecycle: resending a request on ANY document,
 * replacing an approved one without disturbing compliance, archiving, and
 * deleting. No I/O and no "server-only", so the exact decisions the server
 * actions act on are what get tested under `node --test`.
 *
 * The model, in one paragraph. Each requirement is one *live* row. A resend on
 * an approved document adds a second row (a "replacement") linked to the first
 * through replaces_document_id. While that link is set the replacement is
 * invisible to compliance, so the approved original keeps counting exactly as
 * before. Approving the replacement archives the original and clears the link,
 * making it the live row. An archived row (archived_at set) is a record only.
 */

/** The columns of a document row that these rules need. */
export interface LifecycleRow {
  id: string;
  status: DocumentStatus;
  archived_at: string | null;
  replaces_document_id: string | null;
}

/** A live document a company can act on: not archived, not someone's pending replacement. */
export function isLiveDocument(row: Pick<LifecycleRow, "archived_at" | "replaces_document_id">): boolean {
  return row.archived_at === null && row.replaces_document_id === null;
}

/**
 * A replacement that is really pending. A cancelled (revoked) one doesn't
 * count: the company withdrew it, so the original stands alone again.
 */
function isPendingReplacementOf(row: LifecycleRow, originalId: string): boolean {
  return (
    row.replaces_document_id === originalId &&
    row.archived_at === null &&
    row.status !== "revoked"
  );
}

export function findPendingReplacement(
  rows: LifecycleRow[],
  originalId: string,
): LifecycleRow | null {
  return rows.find((r) => isPendingReplacementOf(r, originalId)) ?? null;
}

/**
 * Any non-archived replacement row for an original, including a cancelled one.
 * A resend reuses it (reopening it if it was cancelled) rather than stacking a
 * second replacement beside it.
 */
export function findReplacementRow(rows: LifecycleRow[], originalId: string): LifecycleRow | null {
  return (
    rows.find((r) => r.replaces_document_id === originalId && r.archived_at === null) ?? null
  );
}

// --- which actions exist ----------------------------------------------------

/**
 * Archive and delete only make sense for a document that holds something.
 * A "requested" row has no file (that's what Revoke is for) and a "revoked"
 * row is an already-cancelled request.
 */
export function canArchiveOrDelete(status: DocumentStatus): boolean {
  return status === "approved" || status === "uploaded" || status === "rejected";
}

// --- resend -----------------------------------------------------------------

/** How the resend email describes a document. */
export type EmailBucket =
  /** Something is genuinely outstanding: "documents needed". */
  | "needed"
  /** A copy is already on file and still valid: "updated copy requested". */
  | "refresh";

export type ResendStep =
  /** Just send the email. Nothing changes in the database. */
  | { docId: string; kind: "email_only"; bucket: EmailBucket }
  /** Set a cancelled row back to "requested". */
  | { docId: string; kind: "reopen"; targetId: string; bucket: EmailBucket }
  /** Approved document: add a pending replacement row beside it. */
  | { docId: string; kind: "create_replacement"; bucket: EmailBucket };

export interface ResendTarget {
  id: string;
  status: DocumentStatus;
  /** Approved and past its expiry date. Only meaningful when status is "approved". */
  expired: boolean;
  /** Any non-archived replacement row already attached to this document. */
  replacement: { id: string; status: DocumentStatus } | null;
}

/**
 * Decides what a resend does to each selected document. Works for EVERY
 * status — the company may want a fresh copy of anything.
 *
 * The rule that matters: resending on an approved document must not change its
 * status, expiry, or file. It only ever adds (or reuses) a separate
 * replacement row, so the approved copy keeps counting until the new one is
 * uploaded AND approved.
 *
 * Email wording follows what's true of the document right now. A still-valid
 * approved copy, or one already submitted and awaiting review, is described as
 * an "updated copy" request. An expired one is described as needed, because it
 * is. Nothing tells a contractor that a valid document has expired.
 */
export function planResend(targets: ResendTarget[]): ResendStep[] {
  return targets.map((t): ResendStep => {
    switch (t.status) {
      case "requested":
      case "rejected":
        return { docId: t.id, kind: "email_only", bucket: "needed" };

      case "uploaded":
        // Already submitted; the contractor can still replace it before review.
        return { docId: t.id, kind: "email_only", bucket: "refresh" };

      case "revoked":
        return { docId: t.id, kind: "reopen", targetId: t.id, bucket: "needed" };

      case "approved": {
        const bucket: EmailBucket = t.expired ? "needed" : "refresh";
        if (!t.replacement) return { docId: t.id, kind: "create_replacement", bucket };
        if (t.replacement.status === "revoked") {
          return { docId: t.id, kind: "reopen", targetId: t.replacement.id, bucket };
        }
        return { docId: t.id, kind: "email_only", bucket };
      }
    }
  });
}

// --- archive / delete -------------------------------------------------------

export type ArchivePlan =
  /** Archive just this row (an archived-already or pending-replacement row). */
  | { kind: "archive_only" }
  /** Archive, and promote its pending replacement to the live document. */
  | { kind: "archive_and_promote"; promoteId: string }
  /** Archive, and add a fresh "requested" row so the requirement shows as Missing. */
  | { kind: "archive_and_placeholder" };

/**
 * What archiving a row does to its requirement. The last case is the one that
 * matters for compliance: archive the only live copy and the requirement must
 * not simply vanish (a contractor with every OTHER document approved would then
 * read as fully compliant). It comes back as a new "requested" row instead.
 */
export function planArchive(row: LifecycleRow, all: LifecycleRow[]): ArchivePlan {
  if (row.replaces_document_id !== null) return { kind: "archive_only" };
  const pending = findPendingReplacement(all, row.id);
  if (pending) return { kind: "archive_and_promote", promoteId: pending.id };
  return { kind: "archive_and_placeholder" };
}

export type DeletePlan =
  /** Remove the row. Its pending replacement (if any) is promoted by the database. */
  | { kind: "delete_row" }
  /**
   * The only live copy: remove its files and reset the SAME row to "requested",
   * rather than deleting it. The requirement is never absent from compliance,
   * not even for an instant, and there is no insert that could fail after the
   * delete has already happened.
   */
  | { kind: "reset_to_missing" };

export function planDelete(row: LifecycleRow, all: LifecycleRow[]): DeletePlan {
  if (row.archived_at !== null) return { kind: "delete_row" };
  if (row.replaces_document_id !== null) return { kind: "delete_row" };
  if (findPendingReplacement(all, row.id)) return { kind: "delete_row" };
  return { kind: "reset_to_missing" };
}

/** True when archiving or deleting this row leaves the requirement with no live document. */
export function leavesRequirementMissing(row: LifecycleRow, all: LifecycleRow[]): boolean {
  if (row.archived_at !== null) return false;
  return isLiveDocument(row) && findPendingReplacement(all, row.id) === null;
}

// --- approving a replacement ------------------------------------------------

/**
 * The original an approval should archive, or null when the row being approved
 * isn't a replacement. Approving a replacement is what retires the copy it
 * replaces.
 */
export function originalToArchiveOnApprove(row: Pick<LifecycleRow, "replaces_document_id">): string | null {
  return row.replaces_document_id;
}

// --- display ordering + flags ----------------------------------------------

export interface DisplayFlags {
  id: string;
  /** A pending copy that will replace an approved one once approved. */
  isReplacement: boolean;
  /** A live document with a replacement on the way. */
  hasPendingReplacement: boolean;
  /** Archiving or deleting this would leave the requirement Missing. */
  isOnlyCurrent: boolean;
}

/**
 * Orders non-archived rows for the company's document list — by name, with a
 * replacement directly beneath the document it replaces — and computes the
 * per-row flags the UI needs.
 */
export function arrangeDocuments<T extends LifecycleRow & { documentName: string }>(
  rows: T[],
): (T & DisplayFlags)[] {
  const liveRows = rows.filter((r) => r.archived_at === null);
  const byId = new Set(liveRows.map((r) => r.id));

  const primaries = liveRows
    .filter((r) => r.replaces_document_id === null || !byId.has(r.replaces_document_id))
    .sort((a, b) => a.documentName.localeCompare(b.documentName));

  const out: (T & DisplayFlags)[] = [];
  for (const p of primaries) {
    const children = liveRows.filter((r) => r.replaces_document_id === p.id);
    const pending = findPendingReplacement(liveRows, p.id);
    out.push({
      ...p,
      isReplacement: false,
      hasPendingReplacement: pending !== null,
      isOnlyCurrent: leavesRequirementMissing(p, liveRows),
    });
    for (const c of children) {
      out.push({
        ...c,
        isReplacement: true,
        hasPendingReplacement: false,
        isOnlyCurrent: false,
      });
    }
  }
  return out;
}

// --- the status line beside each document in the resend panel --------------

/**
 * One line saying where a document stands, for the resend checklist. Worded so
 * the company knows what ticking it will do before they do it: an approved copy
 * is described as valid (or expired) and marked when an updated copy is already
 * on its way.
 *
 * `expiryLabel` is pre-formatted by the caller (server-side, so it can't differ
 * from what the browser would print).
 */
export function describeRequirement(input: {
  status: DocumentStatus;
  expiryLabel: string | null;
  expired: boolean;
  hasPendingReplacement: boolean;
}): string {
  switch (input.status) {
    case "requested":
      return "Not uploaded yet";
    case "rejected":
      return "Rejected, waiting on a replacement";
    case "uploaded":
      return "Submitted, awaiting your review";
    case "revoked":
      return "Request cancelled. Sending reopens it";
    case "approved": {
      const base = input.expiryLabel
        ? input.expired
          ? `Approved · expired ${input.expiryLabel}`
          : `Approved · expires ${input.expiryLabel}`
        : "Approved";
      return input.hasPendingReplacement ? `${base} · updated copy requested` : base;
    }
  }
}
