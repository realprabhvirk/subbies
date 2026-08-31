"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Check, X } from "lucide-react";

import { StatusBadge } from "@/app/components/status-badge";
import { Spinner } from "@/app/components/spinner";
import type { DocumentStatus } from "@/lib/types";
import { approveDocument, rejectDocument, getDocumentFileUrl } from "../actions";

export interface ReviewDocument {
  id: string;
  documentName: string;
  defaultDurationMonths: number;
  status: DocumentStatus;
  hasFile: boolean;
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

function DocumentRow({ doc }: { doc: ReviewDocument }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [expiry, setExpiry] = useState(
    doc.expiryDate ?? defaultExpiry(doc.defaultDurationMonths),
  );

  // Optimistic view of this document. Reverts automatically to `doc` when the
  // transition ends, so a failed approve rolls back on its own.
  const [optimisticDoc, applyOptimistic] = useOptimistic(
    doc,
    (current, patch: Partial<ReviewDocument>) => ({ ...current, ...patch }),
  );

  const viewFile = () => {
    setError(null);
    startTransition(async () => {
      const result = await getDocumentFileUrl(doc.id);
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

  const view = optimisticDoc;

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{view.documentName}</p>
          {view.status === "approved" && view.expiryDate && (
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
              Rejected{view.rejectionReason ? ` — ${view.rejectionReason}` : ""}.
              Waiting on a replacement.
            </p>
          )}
        </div>
        <StatusBadge kind="document" status={view.status} />
      </div>

      {(view.hasFile || view.status === "uploaded") && (
        <div className="mt-3 space-y-3">
          {view.hasFile && (
            <button
              type="button"
              onClick={viewFile}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-60"
            >
              {pending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
              )}
              View file
            </button>
          )}

          {view.status === "uploaded" && !rejecting && (
            <div className="flex flex-wrap items-end gap-3 rounded-md bg-surface-muted p-3">
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
                  className="rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
                />
              </div>
              <button
                type="button"
                onClick={approve}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-approved px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {pending ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
                )}
                {pending ? "Approving…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => setRejecting(true)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface disabled:opacity-60"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                Reject
              </button>
            </div>
          )}

          {view.status === "uploaded" && rejecting && (
            <div className="space-y-2 rounded-md border border-expired-line bg-expired-bg p-3">
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
                placeholder="e.g. The certificate has expired — please upload a current one."
                className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmReject}
                  disabled={pending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-expired px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {pending && <Spinner className="h-3.5 w-3.5" />}
                  {pending ? "Sending…" : "Confirm rejection"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejecting(false);
                    setReason("");
                  }}
                  disabled={pending}
                  className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-muted"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-ink-muted">
                The contractor is emailed this reason and can upload a
                replacement.
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-expired">{error}</p>}
      {notice && <p className="mt-2 text-sm text-attention">{notice}</p>}
    </li>
  );
}
