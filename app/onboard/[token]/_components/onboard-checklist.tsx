"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, RefreshCw } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/app/components/status-badge";
import {
  CONTRACTOR_DOCS_BUCKET,
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT_ATTR,
  isAllowedMimeType,
} from "@/lib/storage-constants";
import type { OnboardingChecklistItem } from "@/lib/onboarding";
import {
  requestDocumentUpload,
  confirmDocumentUpload,
  getSubmittedFileUrl,
} from "../actions";

type ItemState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "error"; message: string };

export function OnboardChecklist({
  token,
  items,
}: {
  token: string;
  items: OnboardingChecklistItem[];
}) {
  const router = useRouter();
  const [states, setStates] = useState<Record<string, ItemState>>({});

  const setItemState = (id: string, state: ItemState) =>
    setStates((prev) => ({ ...prev, [id]: state }));

  const handleFile = async (itemId: string, file: File) => {
    const type = file.type || "";
    if (!isAllowedMimeType(type)) {
      setItemState(itemId, {
        phase: "error",
        message: "Upload a PDF, JPG, PNG, or HEIC file.",
      });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setItemState(itemId, {
        phase: "error",
        message: "That file is over the 15 MB limit.",
      });
      return;
    }

    setItemState(itemId, { phase: "uploading" });

    const requested = await requestDocumentUpload(token, itemId, {
      name: file.name,
      type,
      size: file.size,
    });
    if (!requested.ok) {
      setItemState(itemId, { phase: "error", message: requested.error });
      return;
    }

    const supabase = createClient();
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

    const confirmed = await confirmDocumentUpload(token, itemId, requested.path);
    if (!confirmed.ok) {
      setItemState(itemId, {
        phase: "error",
        message: confirmed.error ?? "Couldn't save the upload.",
      });
      return;
    }

    setItemState(itemId, { phase: "idle" });
    router.refresh();
  };

  const viewFile = async (itemId: string) => {
    const result = await getSubmittedFileUrl(token, itemId);
    if (result.ok && result.url) {
      window.open(result.url, "_blank", "noopener,noreferrer");
    } else {
      setItemState(itemId, {
        phase: "error",
        message: result.error ?? "Couldn't open the file.",
      });
    }
  };

  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => {
        const state = states[item.id] ?? { phase: "idle" };
        const canUpload =
          item.status === "requested" ||
          item.status === "rejected" ||
          item.status === "uploaded";
        const isReplace = item.status === "uploaded";

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

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(item.status === "uploaded" || item.status === "approved") && (
                <button
                  type="button"
                  onClick={() => viewFile(item.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted"
                >
                  <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
                  View file
                </button>
              )}

              {canUpload && (
                <FilePicker
                  disabled={state.phase === "uploading"}
                  label={
                    state.phase === "uploading"
                      ? "Uploading…"
                      : isReplace
                        ? "Replace file"
                        : "Upload file"
                  }
                  icon={isReplace ? RefreshCw : Upload}
                  onPick={(file) => handleFile(item.id, file)}
                />
              )}
            </div>

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
  icon: Icon,
  disabled,
  onPick,
}: {
  label: string;
  icon: typeof Upload;
  disabled?: boolean;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </>
  );
}
