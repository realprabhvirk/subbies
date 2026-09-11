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
    <ul className="mt-6 space-y-3">
      {items.map((item) => {
        const state = states[item.id] ?? { phase: "idle" };
        const stagedFiles = staged[item.id] ?? [];
        const canStage = canSubmitDocument(item.status);
        const submitting = state.phase === "submitting";

        return (
          <li key={item.id} className="rounded-md border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="font-medium">{item.documentName}</span>
              <StatusBadge kind="document" status={item.status} />
            </div>

            {item.status === "rejected" && item.rejectionReason && (
              <p className="mt-2 text-sm text-expired">
                Not accepted: {item.rejectionReason}
              </p>
            )}

            {item.files.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.files.map((file, i) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => viewFile(file.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted"
                  >
                    {openingFileId === file.id ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
                    )}
                    {file.fileName ?? (item.files.length > 1 ? `File ${i + 1}` : "View file")}
                  </button>
                ))}
              </div>
            )}

            {canStage && (
              <div className="mt-3 space-y-2">
                {stagedFiles.length > 0 && (
                  <ul className="space-y-1.5">
                    {stagedFiles.map((file, i) => (
                      <li
                        key={`${file.name}-${i}`}
                        className="flex items-center justify-between gap-2 rounded-md bg-surface-muted px-3 py-1.5 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
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
                          className="shrink-0 rounded-md p-1 text-ink-subtle transition-colors hover:bg-line-strong hover:text-ink disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <FilePicker
                    disabled={submitting}
                    label={
                      item.files.length > 0 || stagedFiles.length > 0
                        ? "Add another file"
                        : "Add file"
                    }
                    onPick={(files) => addFiles(item.id, files)}
                  />

                  {stagedFiles.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => submit(item.id)}
                      pending={submitting}
                    >
                      <UploadCloud className="h-4 w-4" strokeWidth={2} aria-hidden />
                      {state.phase === "submitting"
                        ? `Uploading ${Math.min(state.doneCount + 1, state.total)} of ${state.total}…`
                        : `Submit ${stagedFiles.length === 1 ? "file" : `${stagedFiles.length} files`}`}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {state.phase === "error" && (
              <p className="mt-2 text-sm text-expired">{state.message}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FilePicker({
  label,
  disabled,
  onPick,
}: {
  label: string;
  disabled?: boolean;
  onPick: (files: FileList) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4" strokeWidth={2} aria-hidden />
        {label}
      </Button>
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
