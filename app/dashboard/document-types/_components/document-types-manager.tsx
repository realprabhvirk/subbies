"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";

import { fieldClasses } from "@/app/components/input";
import { Button } from "@/app/components/button";
import { IconButton } from "@/app/components/icon-button";
import { IconDisc } from "@/app/components/icon-disc";
import { DialogFrame } from "@/app/components/dialog";
import { EmptyState } from "@/app/components/empty-state";
import { PageHeader } from "@/app/components/page-header";
import { ReminderScheduleField } from "./reminder-schedule-field";
import { LimitBanner } from "@/app/dashboard/_components/limit-banner";
import { UpgradePrompt } from "@/app/components/upgrade-prompt";
import type { PlanError } from "@/lib/billing/plans";
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
  planError = null,
}: {
  types: DocumentType[];
  atLimit?: boolean;
  limit?: number | null;
  /** The server's typed error when the plan (not lapsed access) blocks adding. */
  planError?: PlanError | null;
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
    <div className="space-y-6">
      <PageHeader
        title="Document types"
        description="The compliance documents you collect from contractors. You'll pick from this list when onboarding each contractor."
        actions={
          atLimit ? undefined : (
            <Button type="button" onClick={() => setDialog({ mode: "create" })}>
              <Plus className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              Add document type
            </Button>
          )
        }
      />

      {atLimit &&
        (planError ? (
          <UpgradePrompt error={planError} />
        ) : (
          <LimitBanner resource="document types" limit={limit} accessLapsed />
        ))}

      {deleteError && (
        <p className="rounded-md border border-expired-line bg-expired-bg/70 px-4 py-3 text-sm text-expired">
          {deleteError}
        </p>
      )}

      {types.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No document types yet"
          description="Add the documents you need from contractors, for example Public Liability insurance, a trade licence, or a workers compensation certificate."
          action={
            atLimit ? undefined : (
              <Button type="button" onClick={() => setDialog({ mode: "create" })}>
                <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
                Add document type
              </Button>
            )
          }
        />
      ) : (
        <div className="@container overflow-hidden rounded-card border border-line bg-surface shadow-sm">
          <div
            aria-hidden
            className="hidden grid-cols-[minmax(0,1fr)_9rem_minmax(0,14rem)_5.5rem] items-center gap-6 border-b border-line-strong bg-surface-muted px-6 py-3 text-ink-muted @3xl:grid"
          >
            <span className="label-caps">Document</span>
            <span className="label-caps">Valid for</span>
            <span className="label-caps">Reminders before expiry</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {types.map((type) => (
              <li key={type.id} className="min-h-16 px-card py-3.5 sm:px-6">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 @3xl:grid-cols-[minmax(0,1fr)_9rem_minmax(0,14rem)_5.5rem] @3xl:gap-x-6">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <IconDisc icon={FileText} tone="brand" size="sm" />
                    <h2 className="truncate font-sans text-sm font-semibold stretch-normal">
                      {type.name}
                    </h2>
                  </div>
                  <div className="col-start-2 row-start-1 flex justify-end gap-0.5 @3xl:col-start-4">
                    <IconButton
                      onClick={() => setDialog({ mode: "edit", type })}
                      aria-label={`Edit ${type.name}`}
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2} />
                    </IconButton>
                    <IconButton
                      tone="danger"
                      onClick={() => {
                        setDeleteError(null);
                        setDeletingId(type.id);
                      }}
                      aria-label={`Delete ${type.name}`}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                    </IconButton>
                  </div>
                  <dl className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs @3xl:col-span-2 @3xl:col-start-2 @3xl:row-start-1 @3xl:grid @3xl:grid-cols-[9rem_minmax(0,14rem)] @3xl:gap-x-6">
                    <div>
                      <dt className="sr-only">Default validity</dt>
                      <dd className="text-ink">
                        <span className="font-mono">{type.default_duration_months}</span>{" "}
                        <span className="text-ink-muted">
                          {type.default_duration_months === 1 ? "month" : "months"}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">Reminder schedule</dt>
                      <dd className="flex flex-wrap gap-1">
                        {type.reminder_days.length > 0 ? (
                          type.reminder_days.map((d) => (
                            <span
                              key={d}
                              className="rounded-full border border-line-strong bg-surface-muted px-2.5 py-0.5 font-mono text-2xs text-ink"
                            >
                              {d}d
                            </span>
                          ))
                        ) : (
                          <span className="text-ink-muted">No reminders</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>

                {deletingId === type.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-expired-line bg-expired-bg/50 p-3">
                    <p className="flex-1 text-sm text-expired">
                      Delete <span className="font-semibold">{type.name}</span>?
                      This can&apos;t be undone.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(type.id)}
                        pending={isDeleting}
                      >
                        {isDeleting ? "Deleting…" : "Delete"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setDeletingId(null)}
                        disabled={isDeleting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
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
    <DialogFrame
      titleId="doc-type-dialog-title"
      title={isEdit ? "Edit document type" : "Add document type"}
      onClose={onClose}
    >
        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={existing!.id} />}

          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm font-semibold">
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
              className={fieldClasses()}
            />
            {state?.fieldErrors?.name && (
              <p className="text-sm text-expired">{state.fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="default_duration_months"
              className="block text-sm font-semibold"
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
              className={fieldClasses()}
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

          <ReminderScheduleField
            name="reminder_days"
            defaultValue={existing?.reminder_days ?? [30, 14, 7]}
            error={state?.fieldErrors?.reminder_days}
          />

          {state?.error && (
            <p className="rounded-md border border-expired-line bg-expired-bg/70 px-3 py-2 text-sm text-expired">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" pending={busy}>
              {busy
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Add document type"}
            </Button>
          </div>
        </form>
    </DialogFrame>
  );
}
