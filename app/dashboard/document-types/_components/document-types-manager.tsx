"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, CalendarClock, BellRing } from "lucide-react";

import { Spinner } from "@/app/components/spinner";
import { LimitBanner } from "@/app/dashboard/_components/limit-banner";
import type { DocumentType } from "@/lib/types";
import {
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
  type DocumentTypeFormState,
} from "../actions";

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; type: DocumentType }
  | null;

export function DocumentTypesManager({
  types,
  atLimit = false,
  limit = null,
}: {
  types: DocumentType[];
  atLimit?: boolean;
  limit?: number | null;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const handleDelete = (id: string) => {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteDocumentType(id);
      if (!result.ok) {
        setDeleteError(result.error ?? "Couldn't delete this document type.");
        return;
      }
      setDeletingId(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Document types</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            The compliance documents you collect from contractors. You&apos;ll
            pick from this list when onboarding each contractor.
          </p>
        </div>
        {atLimit ? (
          <Link
            href="/dashboard/settings?tab=billing"
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
          >
            Upgrade to add more
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setDialog({ mode: "create" })}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Add document type
          </button>
        )}
      </header>

      {atLimit && <LimitBanner resource="document types" limit={limit} />}

      {deleteError && (
        <p className="rounded-md bg-expired-bg px-4 py-3 text-sm text-expired">
          {deleteError}
        </p>
      )}

      {types.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
          <p className="text-sm font-medium">No document types yet</p>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">
            Add the documents you need from contractors — for example Public
            Liability insurance, a trade licence, or a workers compensation
            certificate.
          </p>
          <button
            type="button"
            onClick={() => setDialog({ mode: "create" })}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Add document type
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {types.map((type) => (
            <li
              key={type.id}
              className="flex flex-col rounded-card border border-line bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold">{type.name}</h2>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setDialog({ mode: "edit", type })}
                    className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                    aria-label={`Edit ${type.name}`}
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setDeletingId(type.id);
                    }}
                    className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-expired-bg hover:text-expired"
                    aria-label={`Delete ${type.name}`}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-ink-muted">
                  <CalendarClock className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  <dt className="sr-only">Default validity</dt>
                  <dd>
                    Valid for {type.default_duration_months}{" "}
                    {type.default_duration_months === 1 ? "month" : "months"}
                  </dd>
                </div>
                <div className="flex items-center gap-2 text-ink-muted">
                  <BellRing className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  <dt className="sr-only">Reminder schedule</dt>
                  <dd>
                    {type.reminder_days.length > 0
                      ? `Reminders ${type.reminder_days.join(", ")} days before expiry`
                      : "No expiry reminders"}
                  </dd>
                </div>
              </dl>

              {deletingId === type.id && (
                <div className="mt-4 rounded-md border border-expired-line bg-expired-bg p-3">
                  <p className="text-sm text-expired">
                    Delete <span className="font-medium">{type.name}</span>? This
                    can&apos;t be undone.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(type.id)}
                      disabled={isDeleting}
                      className="inline-flex items-center gap-1.5 rounded-md bg-expired px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
                    >
                      {isDeleting && <Spinner className="h-3.5 w-3.5" />}
                      {isDeleting ? "Deleting…" : "Delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(null)}
                      disabled={isDeleting}
                      className="rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {dialog && (
        <DocumentTypeDialog
          key={dialog.mode === "edit" ? dialog.type.id : "create"}
          dialog={dialog}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function DocumentTypeDialog({
  dialog,
  onClose,
  onSaved,
}: {
  dialog: Exclude<DialogState, null>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = dialog.mode === "edit";
  const action = isEdit ? updateDocumentType : createDocumentType;
  const [state, formAction, pending] = useActionState<
    DocumentTypeFormState | null,
    FormData
  >(action, null);
  const [finishing, startFinish] = useTransition();
  const busy = pending || finishing;

  useEffect(() => {
    if (state?.ok) startFinish(onSaved);
  }, [state, onSaved]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const existing = isEdit ? dialog.type : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-brand-ink/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-type-dialog-title"
        className="relative w-full max-w-md rounded-t-card border border-line bg-surface p-6 shadow-xl sm:rounded-card"
      >
        <div className="flex items-start justify-between">
          <h2 id="doc-type-dialog-title" className="text-lg font-semibold">
            {isEdit ? "Edit document type" : "Add document type"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-muted hover:bg-surface-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        <form action={formAction} className="mt-5 space-y-4">
          {isEdit && <input type="hidden" name="id" value={existing!.id} />}

          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={80}
              defaultValue={existing?.name ?? ""}
              placeholder="e.g. Public Liability insurance"
              className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
            {state?.fieldErrors?.name && (
              <p className="text-sm text-expired">{state.fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="default_duration_months"
              className="block text-sm font-medium"
            >
              Default validity (months)
            </label>
            <input
              id="default_duration_months"
              name="default_duration_months"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              required
              defaultValue={existing?.default_duration_months ?? 12}
              className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <p className="text-xs text-ink-subtle">
              Used to pre-fill the expiry date when a document is approved. Still
              editable per document.
            </p>
            {state?.fieldErrors?.default_duration_months && (
              <p className="text-sm text-expired">
                {state.fieldErrors.default_duration_months}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reminder_days" className="block text-sm font-medium">
              Reminder schedule (days before expiry)
            </label>
            <input
              id="reminder_days"
              name="reminder_days"
              type="text"
              defaultValue={(existing?.reminder_days ?? [30, 14, 7]).join(", ")}
              placeholder="30, 14, 7"
              className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <p className="text-xs text-ink-subtle">
              Comma-separated. Leave blank for no reminders.
            </p>
            {state?.fieldErrors?.reminder_days && (
              <p className="text-sm text-expired">
                {state.fieldErrors.reminder_days}
              </p>
            )}
          </div>

          {state?.error && (
            <p className="rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-line-strong px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
            >
              {busy && <Spinner className="h-4 w-4" />}
              {busy
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Add document type"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
