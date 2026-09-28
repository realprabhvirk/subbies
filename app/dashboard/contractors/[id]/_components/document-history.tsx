"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, FileText, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/app/components/confirm-dialog";
import { IconButton } from "@/app/components/icon-button";
import { Spinner } from "@/app/components/spinner";
import { getDocumentFileUrl } from "../actions";
import { deleteDocument } from "../document-lifecycle-actions";

export interface HistoryItem {
  id: string;
  documentName: string;
  /** Formatted on the server. Null when the document never had an expiry. */
  expiryLabel: string | null;
  archivedLabel: string;
  files: { id: string; fileName: string | null }[];
}

/**
 * Archived documents: records only. They don't count toward compliance or the
 * dashboard and never reach the contractor or an email. Files open through
 * short-lived signed links, never a public URL, and each record can be deleted
 * for good (files and all) after a confirmation.
 */
export function DocumentHistory({ items }: { items: HistoryItem[] }) {
  return (
    <section>
      <h2 className="text-base font-semibold">Document history</h2>
      <p className="mt-0.5 text-sm text-ink-muted">
        Archived documents, kept as a record. They don&apos;t count toward compliance.
      </p>

      {items.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
          <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-ink-subtle">
            <Archive className="h-5 w-5" strokeWidth={2} aria-hidden />
          </span>
          <p className="text-sm font-medium">Nothing archived yet</p>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">
            Documents you archive, and ones replaced by an approved updated copy, are
            kept here.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-sm">
          {items.map((item) => (
            <HistoryRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const view = (fileId: string) => {
    setError(null);
    setOpeningId(fileId);
    startTransition(async () => {
      const result = await getDocumentFileUrl(fileId);
      setOpeningId(null);
      if (result.ok && result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        setError(result.error ?? "Couldn't open the file.");
      }
    });
  };

  const remove = () => {
    setConfirmError(null);
    startTransition(async () => {
      const result = await deleteDocument(item.id);
      if (!result.ok) {
        setConfirmError(result.error ?? "Couldn't delete this document.");
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  };

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{item.documentName}</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {item.expiryLabel ? `Expiry ${item.expiryLabel}` : "No expiry date"}
            {" · "}Archived {item.archivedLabel}
          </p>
        </div>
        <IconButton
          tone="danger"
          onClick={() => {
            setConfirmError(null);
            setConfirming(true);
          }}
          disabled={pending}
          aria-label={`Delete ${item.documentName} permanently`}
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
        </IconButton>
      </div>

      {item.files.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.files.map((file, i) => (
            <button
              key={file.id}
              type="button"
              onClick={() => view(file.id)}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-60"
            >
              {openingId === file.id ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
              )}
              {file.fileName ?? (item.files.length > 1 ? `File ${i + 1}` : "View file")}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-subtle">No file was attached to this record.</p>
      )}

      {error && <p className="mt-2 text-sm text-expired">{error}</p>}

      {confirming && (
        <ConfirmDialog
          title={`Delete ${item.documentName}?`}
          confirmLabel="Delete permanently"
          pendingLabel="Deleting…"
          pending={pending}
          error={confirmError}
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        >
          <p>
            This archived record and its{" "}
            {item.files.length === 1 ? "file are" : "files are"} permanently removed from
            storage. This can&apos;t be recovered.
          </p>
        </ConfirmDialog>
      )}
    </li>
  );
}
