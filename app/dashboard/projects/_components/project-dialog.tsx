"use client";

import { useActionState, useEffect, useTransition } from "react";

import { Spinner } from "@/app/components/spinner";
import type { ProjectStatus } from "@/lib/types";
import { createProject, updateProject, type ProjectFormState } from "../actions";

export interface ProjectDialogData {
  id: string;
  name: string;
  address: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
];

const inputClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export function ProjectDialog({
  project,
  onClose,
  onSaved,
}: {
  /** Provide to edit; omit to create. */
  project?: ProjectDialogData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(project);
  const action = isEdit ? updateProject : createProject;
  const [state, formAction, pending] = useActionState<
    ProjectFormState | null,
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-warm-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        className="relative w-full max-w-md rounded-t-card border border-line bg-surface p-6 shadow-xl sm:rounded-card"
      >
        <div className="flex items-start justify-between">
          <h2 id="project-dialog-title" className="text-lg font-semibold">
            {isEdit ? "Edit project" : "New project"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-muted hover:bg-surface-muted"
            aria-label="Close"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>

        <form action={formAction} className="mt-5 space-y-4">
          {isEdit && <input type="hidden" name="id" value={project!.id} />}

          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm font-medium">
              Project name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={120}
              defaultValue={project?.name ?? ""}
              placeholder="e.g. Smith Street renovation"
              className={inputClass}
            />
            {state?.fieldErrors?.name && (
              <p className="text-sm text-expired">{state.fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="address" className="block text-sm font-medium">
              Address{" "}
              <span className="font-normal text-ink-subtle">(optional)</span>
            </label>
            <input
              id="address"
              name="address"
              type="text"
              maxLength={250}
              defaultValue={project?.address ?? ""}
              className={inputClass}
            />
            {state?.fieldErrors?.address && (
              <p className="text-sm text-expired">{state.fieldErrors.address}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="status" className="block text-sm font-medium">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={project?.status ?? "active"}
              className={inputClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="start_date" className="block text-sm font-medium">
                Start date
              </label>
              <input
                id="start_date"
                name="start_date"
                type="date"
                defaultValue={project?.startDate ?? ""}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="end_date" className="block text-sm font-medium">
                End date
              </label>
              <input
                id="end_date"
                name="end_date"
                type="date"
                defaultValue={project?.endDate ?? ""}
                className={inputClass}
              />
            </div>
          </div>
          {state?.fieldErrors?.dates && (
            <p className="text-sm text-expired">{state.fieldErrors.dates}</p>
          )}

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
              {busy ? "Saving…" : isEdit ? "Save changes" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
