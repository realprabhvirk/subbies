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
} from "lucide-react";

import { StatusBadge } from "@/app/components/status-badge";
import { Button } from "@/app/components/button";
import { IconButton } from "@/app/components/icon-button";
import { Spinner } from "@/app/components/spinner";
import { fieldClasses } from "@/app/components/input";
import type { DocumentStatus } from "@/lib/types";
import {
  canRevoke,
  canResendRequest,
  canEditApprovedExpiry,
} from "@/lib/document-actions-logic";
import {
  approveDocument,
  rejectDocument,
  revokeDocumentRequest,
  resendDocumentRequest,
  updateApprovedDocumentExpiry,
  getDocumentFileUrl,
} from "../actions";

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
  rejectionReason: string | null;
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
      <p className="rounded-card border border-line bg-surface shadow-sm px-5 py-8 text-center text-sm text-ink-muted">
        No documents were requested from this contractor.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-sm">
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
  disabled,
}: {
  doc: ReviewDocument;
  onRevoke: () => void;
  onResend: () => void;
  onEditExpiry: () => void;
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

  if (!revocable && !resendable && !editableExpiry) return null;

  const item = (label: string, icon: React.ReactNode, onClick: () => void, danger = false) => (
    <button
      type="button"
      onClick={() => {
        setOpen(false);
        onClick();
      }}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
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
        <div className="absolute right-0 z-20 mt-1.5 w-52 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-lg">
          {resendable &&
            item(
              "Send new request",
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
      applyOptimistic({ status: "approved", expiryDate: expiry });
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

  const saveExpiry = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      applyOptimistic({ expiryDate: editExpiryValue });
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
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{view.documentName}</p>
          {view.status === "approved" && view.expiryDate && !editingExpiry && (
            <p className="mt-0.5 text-sm text-ink-muted">
              Expires {formatDate(view.expiryDate)}
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
        <div className="flex shrink-0 items-center gap-1.5">
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
              className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-60"
            >
              {openingFileId === file.id ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
              )}
              {file.fileName ?? (view.files.length > 1 ? `File ${i + 1}` : "View file")}
            </button>
          ))}
        </div>
      )}

      {editingExpiry && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md bg-surface-muted p-3">
          <div className="space-y-1">
            <label
              htmlFor={`edit-expiry-${doc.id}`}
              className="block text-xs font-medium text-ink-muted"
            >
              New expiry date
            </label>
            <input
              id={`edit-expiry-${doc.id}`}
              type="date"
              value={editExpiryValue}
              onChange={(e) => setEditExpiryValue(e.target.value)}
              className={fieldClasses(false, "py-1.5")}
            />
          </div>
          <Button type="button" size="sm" onClick={saveExpiry} pending={pending}>
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditingExpiry(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <p className="w-full text-xs text-ink-subtle">
            This only corrects the recorded date — it doesn&apos;t touch the
            uploaded file. To replace the file itself, reject the document so
            the contractor can upload a new one.
          </p>
        </div>
      )}

      {view.status === "uploaded" && !rejecting && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md bg-surface-muted p-3">
          <div className="space-y-1">
            <label
              htmlFor={`expiry-${doc.id}`}
              className="block text-xs font-medium text-ink-muted"
            >
              Expiry date
            </label>
            <input
              id={`expiry-${doc.id}`}
              type="date"
              value={expiry}
              min={toISODate(new Date())}
              onChange={(e) => setExpiry(e.target.value)}
              className={fieldClasses(false, "py-1.5")}
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
        <div className="mt-3 space-y-2 rounded-md border border-expired-line bg-expired-bg p-3">
          <label
            htmlFor={`reason-${doc.id}`}
            className="block text-sm font-medium text-expired"
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
          <div className="flex gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={confirmReject}
              pending={pending}
            >
              {pending ? "Sending…" : "Confirm rejection"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
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

      {error && <p className="mt-2 text-sm text-expired">{error}</p>}
      {notice && <p className="mt-2 text-sm text-attention">{notice}</p>}
    </li>
  );
}
