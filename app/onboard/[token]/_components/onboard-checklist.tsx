"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X, UploadCloud } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/app/components/status-badge";
import { Button } from "@/app/components/button";
import { Spinner } from "@/app/components/spinner";
import {
  CONTRACTOR_DOCS_BUCKET,
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT_ATTR,
  isAllowedMimeType,
} from "@/lib/storage-constants";
import { canSubmitDocument, validateStagedBatch } from "@/lib/document-actions-logic";
import type { OnboardingChecklistItem } from "@/lib/onboarding";
import {
  requestDocumentUpload,
  submitStagedDocuments,
  getSubmittedFileUrl,
} from "../actions";

type ItemState =
  | { phase: "idle" }
  | { phase: "submitting"; doneCount: number; total: number }
  | { phase: "error"; message: string };

/**
 * Files the contractor has picked for one document requirement but hasn't
 * submitted yet — plain in-memory File objects, nothing touches the network
 * until "Submit" is clicked. Keyed by document requirement id.
 */
type StagedByItem = Record<string, File[]>;

export function OnboardChecklist({
  token,
  items,
}: {
  token: string;
  items: OnboardingChecklistItem[];
}) {
  const router = useRouter();
  const [states, setStates] = useState<Record<string, ItemState>>({});
  const [staged, setStaged] = useState<StagedByItem>({});
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);

  const setItemState = (id: string, state: ItemState) =>
    setStates((prev) => ({ ...prev, [id]: state }));

  const addFiles = (itemId: string, picked: FileList) => {
    const incoming = Array.from(picked);
    const combined = [...(staged[itemId] ?? []), ...incoming];
    const validity = validateStagedBatch(combined, {
      isAllowedMimeType,
      maxBytes: MAX_UPLOAD_BYTES,
    });
    if (!validity.ok) {
      setItemState(itemId, { phase: "error", message: validity.error! });
      return;
    }

    setItemState(itemId, { phase: "idle" });
    setStaged((prev) => ({ ...prev, [itemId]: combined }));
  };

  const removeStagedFile = (itemId: string, index: number) => {
    setStaged((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] ?? []).filter((_, i) => i !== index),
    }));
  };

  const submit = async (itemId: string) => {
    const files = staged[itemId] ?? [];
    if (files.length === 0) return;

    setItemState(itemId, { phase: "submitting", doneCount: 0, total: files.length });
    const supabase = createClient();
    const uploaded: { path: string; fileName: string }[] = [];

    for (const file of files) {
      const type = file.type || "";
      const requested = await requestDocumentUpload(token, itemId, {
        name: file.name,
        type,
        size: file.size,
      });
      if (!requested.ok) {
        setItemState(itemId, { phase: "error", message: requested.error });
        return;
      }

      const { error: uploadError } = await supabase.storage
        .from(CONTRACTOR_DOCS_BUCKET)
        .uploadToSignedUrl(requested.path, requested.uploadToken, file, {
          contentType: type,
        });
      if (uploadError) {
        setItemState(itemId, {
          phase: "error",
          message: "The upload didn't complete. Check your connection and try again.",
        });
        return;
      }

      uploaded.push({ path: requested.path, fileName: file.name });
      setItemState(itemId, {
        phase: "submitting",
        doneCount: uploaded.length,
        total: files.length,
      });
    }

    const confirmed = await submitStagedDocuments(token, itemId, uploaded);
    if (!confirmed.ok) {
      setItemState(itemId, {
        phase: "error",
        message: confirmed.error ?? "Couldn't save the upload.",
      });
      return;
    }

    setStaged((prev) => ({ ...prev, [itemId]: [] }));
    setItemState(itemId, { phase: "idle" });
    router.refresh();
  };

  const viewFile = async (fileId: string) => {
    setOpeningFileId(fileId);
    const result = await getSubmittedFileUrl(token, fileId);
    setOpeningFileId(null);
    if (result.ok && result.url) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <ol className="mt-6 space-y-3">
      {items.map((item, index) => {
        const state = states[item.id] ?? { phase: "idle" };
        const stagedFiles = staged[item.id] ?? [];
        const canStage = canSubmitDocument(item.status);
        const submitting = state.phase === "submitting";
        const needsAction = item.status === "requested" || item.status === "rejected";

        return (
          <li
            key={item.id}
            className={`rounded-card border bg-surface ${
              item.status === "rejected"
                ? "border-expired-line"
                : needsAction
                  ? "border-line-strong"
                  : "border-line"
            }`}
          >
            <div className="flex items-start gap-3 p-4 sm:p-5">
              <span className="mt-0.5 font-mono text-xs text-ink-subtle">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                  <p className="font-semibold text-ink">{item.documentName}</p>
                  <StatusBadge kind="document" status={item.status} size="sm" />
                </div>

                {item.isReplacement && (
                  <p className="mt-2 text-sm text-ink-muted">
                    Updated copy requested. What you sent before stays valid until
                    this one is approved.
                  </p>
                )}

                {item.status === "rejected" && item.rejectionReason && (
                  <div className="mt-3 rounded-md border border-expired-line bg-expired-bg/60 px-3 py-2.5 text-sm text-expired">
                    <p className="label-caps">Not accepted</p>
                    <p className="mt-1">{item.rejectionReason}</p>
                  </div>
                )}

                {item.files.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.files.map((file, i) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => viewFile(file.id)}
                        className="pressable inline-flex min-h-11 max-w-full items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-left hover:border-field-line hover:bg-surface-muted"
                      >
                        {openingFileId === file.id ? (
                          <Spinner className="h-4 w-4 shrink-0 text-ink-muted" />
                        ) : (
                          <FileText className="h-4 w-4 shrink-0 text-ink-subtle" strokeWidth={2} aria-hidden />
                        )}
                        <span className="truncate font-mono text-xs text-ink">
                          {file.fileName ?? (item.files.length > 1 ? `File ${i + 1}` : "View file")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {canStage && (
              <div className="space-y-2.5 border-t border-line p-4 sm:p-5">
                {stagedFiles.length > 0 && (
                  <ul className="space-y-1.5">
                    {stagedFiles.map((file, i) => (
                      <li
                        key={`${file.name}-${i}`}
                        className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-line bg-surface-muted pl-3 pr-1 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText
                            className="h-4 w-4 shrink-0 text-ink-subtle"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <span className="truncate">{file.name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeStagedFile(item.id, i)}
                          disabled={submitting}
                          aria-label={`Remove ${file.name}`}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-line-strong hover:text-ink disabled:opacity-60"
                        >
                          <X className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <FilePicker
                  disabled={submitting}
                  prominent={stagedFiles.length === 0 && needsAction}
                  label={
                    item.files.length > 0 || stagedFiles.length > 0
                      ? "Add another file"
                      : "Add a file or take a photo"
                  }
                  onPick={(files) => addFiles(item.id, files)}
                />

                {stagedFiles.length > 0 && (
                  <Button
                    type="button"
                    size="lg"
                    fullWidth
                    onClick={() => submit(item.id)}
                    pending={submitting}
                  >
                    {!submitting && (
                      <UploadCloud className="h-5 w-5" strokeWidth={2} aria-hidden />
                    )}
                    {state.phase === "submitting"
                      ? `Uploading ${Math.min(state.doneCount + 1, state.total)} of ${state.total}…`
                      : `Submit ${stagedFiles.length === 1 ? "file" : `${stagedFiles.length} files`}`}
                  </Button>
                )}

                {state.phase === "error" && (
                  <p role="alert" className="text-sm font-medium text-expired">
                    {state.message}
                  </p>
                )}
              </div>
            )}

            {!canStage && state.phase === "error" && (
              <p role="alert" className="border-t border-line px-4 py-3 text-sm font-medium text-expired sm:px-5">
                {state.message}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function FilePicker({
  label,
  disabled,
  prominent = false,
  onPick,
}: {
  label: string;
  disabled?: boolean;
  /** The first, empty pick: a big full-width target for a thumb. */
  prominent?: boolean;
  onPick: (files: FileList) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={`pressable flex w-full items-center justify-center gap-2 rounded-md border border-dashed font-semibold disabled:cursor-not-allowed disabled:opacity-55 ${
          prominent
            ? "min-h-16 border-field-line bg-surface-muted/60 text-base text-ink hover:border-brand hover:bg-brand-tint/50 hover:text-brand"
            : "min-h-12 border-line-strong text-sm text-ink-muted hover:border-field-line hover:text-ink"
        }`}
      >
        <Upload className={prominent ? "h-5 w-5" : "h-4 w-4"} strokeWidth={2} aria-hidden />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) onPick(files);
          e.target.value = "";
        }}
      />
    </>
  );
}
