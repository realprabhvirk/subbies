"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Check,
  X,
  MoreVertical,
  Ban,
  Send,
  Pencil,
  Archive,
  Trash2,
  CalendarClock,
} from "lucide-react";

import { StatusBadge } from "@/app/components/status-badge";
import { Button } from "@/app/components/button";
import { IconButton } from "@/app/components/icon-button";
import { Spinner } from "@/app/components/spinner";
import { ConfirmDialog } from "@/app/components/confirm-dialog";
import { fieldClasses } from "@/app/components/input";
import type { DocumentStatus } from "@/lib/types";
import {
  canRevoke,
  canResendRequest,
  canEditApprovedExpiry,
} from "@/lib/document-actions-logic";
import { canArchiveOrDelete } from "@/lib/document-lifecycle-logic";
import {
  approveDocument,
  rejectDocument,
  revokeDocumentRequest,
  resendDocumentRequest,
  updateApprovedDocumentExpiry,
  getDocumentFileUrl,
} from "../actions";
import { archiveDocument, deleteDocument } from "../document-lifecycle-actions";

export interface ReviewDocumentFile {
  id: string;
  fileName: string | null;
}

export interface ReviewDocument {
  id: string;
  documentName: string;
  defaultDurationMonths: number;
  status: DocumentStatus;
  files: ReviewDocumentFile[];
  expiryDate: string | null;
  /** Computed on the server from expiryDate; null when there's nothing to flag. */
  expiryStatus?: { tone: "expired" | "soon" | "ok"; detail: string | null } | null;
  rejectionReason: string | null;
  /**
   * A pending copy that will replace an approved one once approved. The
   * approved original stays valid, and counted, until then.
   */
  isReplacement?: boolean;
  /** A live document with an updated copy already requested. */
  hasPendingReplacement?: boolean;
  /** Archiving or deleting this leaves the requirement Missing (drives the warning). */
  isOnlyCurrent?: boolean;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultExpiry(months: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() + months);
  return toISODate(d);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso + "T00:00:00"));
}

export function DocumentReviewList({
  documents,
}: {
  documents: ReviewDocument[];
}) {
  if (documents.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line-strong px-card py-8 text-center text-sm text-ink-muted">
        No documents were requested from this contractor.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line rounded-card border border-line bg-surface">
      {documents.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} />
      ))}
    </ul>
  );
}

/**
 * The per-row "…" actions menu. Only ever offers actions that are actually
 * valid for the document's current status — the server actions behind each
 * one enforce the same rule independently, but there's no reason to show a
 * button whose click would just come back with an error.
 */
function ActionsMenu({
  doc,
  onRevoke,
  onResend,
  onEditExpiry,
  onArchive,
  onDelete,
  disabled,
}: {
  doc: ReviewDocument;
  onRevoke: () => void;
  onResend: () => void;
  onEditExpiry: () => void;
  onArchive: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const revocable = canRevoke(doc.status);
  const resendable = canResendRequest(doc.status);
  const editableExpiry = canEditApprovedExpiry(doc.status);
  const removable = canArchiveOrDelete(doc.status);

  if (!revocable && !resendable && !editableExpiry && !removable) return null;

  const item = (label: string, icon: React.ReactNode, onClick: () => void, danger = false) => (
    <button
      type="button"
      onClick={() => {
        setOpen(false);
        onClick();
      }}
      disabled={disabled}
      className={`flex min-h-10 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        danger
          ? "text-expired hover:bg-expired-bg"
          : "text-ink hover:bg-surface-muted"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <IconButton
        onClick={() => setOpen((o) => !o)}
        aria-label={`Actions for ${doc.documentName}`}
        disabled={disabled}
      >
        <MoreVertical className="h-4 w-4" strokeWidth={2} />
      </IconButton>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 origin-top-right overflow-hidden rounded-card border border-line bg-surface p-1 shadow-lg">
          {resendable &&
            item(
              // An approved copy stays valid; what's being asked for is a fresh one.
              doc.status === "approved" ? "Request updated copy" : "Send new request",
              <Send className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />,
              onResend,
            )}
          {editableExpiry &&
            item(
              "Edit expiry date",
              <Pencil className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />,
              onEditExpiry,
            )}
          {revocable &&
            item(
              "Revoke request",
              <Ban className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />,
              onRevoke,
              true,
            )}
          {removable && (
            <div className="-mx-1 my-1 border-t border-line" role="separator" />
          )}
          {removable &&
            item(
              "Archive",
              <Archive className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />,
              onArchive,
            )}
          {removable &&
            item(
              "Delete permanently",
              <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />,
              onDelete,
              true,
            )}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ doc }: { doc: ReviewDocument }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [editingExpiry, setEditingExpiry] = useState(false);
  const [expiry, setExpiry] = useState(
    doc.expiryDate ?? defaultExpiry(doc.defaultDurationMonths),
  );
  const [editExpiryValue, setEditExpiryValue] = useState(doc.expiryDate ?? "");
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"archive" | "delete" | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Optimistic view of this document. Reverts automatically to `doc` when the
  // transition ends, so a failed action rolls back on its own.
  const [optimisticDoc, applyOptimistic] = useOptimistic(
    doc,
    (current, patch: Partial<ReviewDocument>) => ({ ...current, ...patch }),
  );

  const viewFile = (fileId: string) => {
    setError(null);
    setOpeningFileId(fileId);
    startTransition(async () => {
      const result = await getDocumentFileUrl(fileId);
      setOpeningFileId(null);
      if (result.ok && result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        setError(result.error ?? "Couldn't open the file.");
      }
    });
  };

  const approve = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      applyOptimistic({
        status: "approved",
        expiryDate: expiry,
        expiryStatus: null,
        isReplacement: false,
      });
      const result = await approveDocument(doc.id, expiry);
      if (!result.ok) {
        setError(result.error ?? "Couldn't approve.");
        return;
      }
      router.refresh();
    });
  };

  const confirmReject = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await rejectDocument(doc.id, reason);
      if (!result.ok) {
        setError(result.error ?? "Couldn't reject.");
        return;
      }
      setRejecting(false);
      setReason("");
      if (result.emailWarning) setNotice(result.emailWarning);
      router.refresh();
    });
  };

  const revoke = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      applyOptimistic({ status: "revoked" });
      const result = await revokeDocumentRequest(doc.id);
      if (!result.ok) {
        setError(result.error ?? "Couldn't revoke this request.");
        return;
      }
      router.refresh();
    });
  };

  const resend = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await resendDocumentRequest(doc.id);
      if (!result.ok) {
        setError(result.error ?? "Couldn't send the request.");
        return;
      }
      setNotice(`Request re-sent for ${doc.documentName}.`);
    });
  };

  const runLifecycle = (kind: "archive" | "delete") => {
    setConfirmError(null);
    startTransition(async () => {
      const result =
        kind === "archive" ? await archiveDocument(doc.id) : await deleteDocument(doc.id);
      if (!result.ok) {
        setConfirmError(result.error ?? "Something went wrong. Try again.");
        return;
      }
      setConfirming(null);
      router.refresh();
    });
  };

  const saveExpiry = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      applyOptimistic({ expiryDate: editExpiryValue, expiryStatus: null });
      const result = await updateApprovedDocumentExpiry(doc.id, editExpiryValue);
      if (!result.ok) {
        setError(result.error ?? "Couldn't update the expiry date.");
        return;
      }
      setEditingExpiry(false);
      router.refresh();
    });
  };

  const view = optimisticDoc;

  return (
    <li className="relative px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-60">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-ink">
            {view.documentName}
            {view.isReplacement && (
              <span className="rounded-sm border border-review-line bg-review-bg px-1.5 py-0.5 text-2xs font-semibold text-review">
                Updated copy
              </span>
            )}
          </p>
          {view.isReplacement && (
            <p className="mt-0.5 text-sm text-ink-muted">
              The approved copy stays valid until this one is approved, then it moves
              to Document history.
            </p>
          )}
          {view.hasPendingReplacement && (
            <p className="mt-0.5 text-sm text-ink-muted">
              Updated copy requested. This one stays valid until it&apos;s replaced.
            </p>
          )}
          {view.status === "requested" && (
            <p className="mt-0.5 text-sm text-ink-muted">
              Waiting on the contractor to upload.
            </p>
          )}
          {view.status === "rejected" && (
            <p className="mt-0.5 text-sm text-ink-muted">
              Rejected{view.rejectionReason ? `: ${view.rejectionReason}` : ""}.
              Waiting on a replacement.
            </p>
          )}
          {view.status === "revoked" && (
            <p className="mt-0.5 text-sm text-ink-muted">
              Request cancelled before the contractor responded.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Expiry sits beside the stamp, so "approved, but nearly due"
              reads as one fact rather than a green badge contradicted by red
              text underneath it. */}
          {view.status === "approved" && view.expiryDate && !editingExpiry && (
            <ExpiryTag
              date={formatDate(view.expiryDate)}
              tone={view.expiryStatus?.tone ?? "ok"}
              detail={view.expiryStatus?.detail ?? null}
            />
          )}
          <StatusBadge kind="document" status={view.status} />
          <ActionsMenu
            doc={view}
            disabled={pending}
            onRevoke={revoke}
            onResend={resend}
            onEditExpiry={() => {
              setEditExpiryValue(view.expiryDate ?? "");
              setEditingExpiry(true);
            }}
            onArchive={() => {
              setConfirmError(null);
              setConfirming("archive");
            }}
            onDelete={() => {
              setConfirmError(null);
              setConfirming("delete");
            }}
          />
        </div>
      </div>

      {view.files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {view.files.map((file, i) => (
            <button
              key={file.id}
              type="button"
              onClick={() => viewFile(file.id)}
              disabled={pending}
              className="pressable inline-flex min-h-9 max-w-full items-center gap-2 rounded-md border border-line-strong bg-surface px-2.5 text-left hover:border-field-line hover:bg-surface-muted disabled:opacity-60 pointer-coarse:min-h-11"
            >
              {openingFileId === file.id ? (
                <Spinner className="h-4 w-4 shrink-0 text-ink-muted" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-ink-subtle" strokeWidth={2} aria-hidden />
              )}
              <span className="truncate font-mono text-xs text-ink">
                {file.fileName ?? (view.files.length > 1 ? `File ${i + 1}` : "View file")}
              </span>
            </button>
          ))}
        </div>
      )}

      {editingExpiry && (
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-line-strong bg-surface-muted/60 p-3 sm:p-4">
          <div className="space-y-1.5">
            <label
              htmlFor={`edit-expiry-${doc.id}`}
              className="label-caps block text-ink-muted"
            >
              New expiry date
            </label>
            <input
              id={`edit-expiry-${doc.id}`}
              type="date"
              value={editExpiryValue}
              onChange={(e) => setEditExpiryValue(e.target.value)}
              className={fieldClasses(false, "w-44 font-mono")}
            />
          </div>
          <Button type="button" onClick={saveExpiry} pending={pending}>
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setEditingExpiry(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <p className="w-full text-xs text-ink-muted">
            This only corrects the recorded date — it doesn&apos;t touch the
            uploaded file. To replace the file itself, reject the document so
            the contractor can upload a new one.
          </p>
        </div>
      )}

      {view.status === "uploaded" && !rejecting && (
        // The decision bar: tinted in the "awaiting review" hue so it reads
        // as the thing waiting on you, not a disabled grey well.
        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-review-line bg-review-bg/40 p-3 sm:p-4">
          <p className="label-caps w-full text-review">Your review</p>
          <div className="space-y-1.5">
            <label
              htmlFor={`expiry-${doc.id}`}
              className="block text-xs font-semibold text-ink"
            >
              Expiry date
            </label>
            <input
              id={`expiry-${doc.id}`}
              type="date"
              value={expiry}
              min={toISODate(new Date())}
              onChange={(e) => setExpiry(e.target.value)}
              className={fieldClasses(false, "w-44 font-mono")}
            />
          </div>
          <Button type="button" onClick={approve} pending={pending}>
            <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
            {pending ? "Approving…" : "Approve"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRejecting(true)}
            disabled={pending}
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
            Reject
          </Button>
        </div>
      )}

      {view.status === "uploaded" && rejecting && (
        <div className="mt-4 space-y-3 rounded-md border border-expired-line bg-expired-bg/50 p-3 sm:p-4">
          <label
            htmlFor={`reason-${doc.id}`}
            className="block text-sm font-semibold text-expired"
          >
            Why is this being rejected?
          </label>
          <textarea
            id={`reason-${doc.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. The certificate has expired, please upload a current one."
            className={fieldClasses()}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="danger"
              onClick={confirmReject}
              pending={pending}
            >
              {pending ? "Sending…" : "Confirm rejection"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setRejecting(false);
                setReason("");
              }}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            The contractor is emailed this reason and can upload a
            replacement.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-medium text-expired">{error}</p>}
      {notice && <p className="mt-3 text-sm font-medium text-attention">{notice}</p>}

      {confirming === "archive" && (
        <ConfirmDialog
          title={`Archive ${view.documentName}?`}
          tone="primary"
          confirmLabel="Archive"
          pendingLabel="Archiving…"
          pending={pending}
          error={confirmError}
          onConfirm={() => runLifecycle("archive")}
          onClose={() => setConfirming(null)}
        >
          <p>
            It moves to Document history and stays in private storage as a record. It
            no longer counts toward compliance or the dashboard, and the contractor
            can&apos;t see it.
          </p>
          {view.isOnlyCurrent && <MissingWarning name={view.documentName} />}
        </ConfirmDialog>
      )}

      {confirming === "delete" && (
        <ConfirmDialog
          title={`Delete ${view.documentName}?`}
          confirmLabel="Delete permanently"
          pendingLabel="Deleting…"
          pending={pending}
          error={confirmError}
          onConfirm={() => runLifecycle("delete")}
          onClose={() => setConfirming(null)}
        >
          <p>
            The file is removed from storage and the record is deleted. This
            can&apos;t be recovered.
          </p>
          {view.isOnlyCurrent && <MissingWarning name={view.documentName} />}
        </ConfirmDialog>
      )}
    </li>
  );
}

/**
 * Shown when archiving or deleting would leave the requirement with no live
 * document, so the consequence is stated before it happens rather than
 * discovered on the dashboard afterwards.
 */
function MissingWarning({ name }: { name: string }) {
  return (
    <p className="mt-3 rounded-md border border-attention-line bg-attention-bg/70 px-3 py-2 text-attention">
      This is the only current copy of {name}. The requirement goes back to{" "}
      <strong>Missing</strong> and the contractor&apos;s compliance status will update.
    </p>
  );
}

/**
 * Expiry beside the status stamp. Calm mono date when it's fine; the
 * attention tint with the days left when it's due soon; expired in the
 * expired colour. Always says it in words as well as colour.
 */
function ExpiryTag({
  date,
  tone,
  detail,
}: {
  date: string;
  tone: "expired" | "soon" | "ok";
  detail: string | null;
}) {
  if (tone === "ok") {
    return (
      <span className="whitespace-nowrap text-xs text-ink-muted">
        Expires <span className="font-mono text-ink">{date}</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 text-xs font-semibold ${
        tone === "expired"
          ? "border-expired-line bg-expired-bg text-expired"
          : "border-attention-line bg-attention-bg text-attention"
      }`}
    >
      <CalendarClock className="h-4 w-4" strokeWidth={2.25} aria-hidden />
      {tone === "expired" ? "Expired" : "Expires"}{" "}
      <span className="font-mono font-medium">{date}</span>
      {detail && <span className="hidden font-medium sm:inline">· {detail}</span>}
    </span>
  );
}
