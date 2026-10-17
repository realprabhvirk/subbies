"use client";

import { useActionState, useEffect, useTransition } from "react";

import { Button } from "@/app/components/button";
import { DialogFrame } from "@/app/components/dialog";
import { fieldClasses } from "@/app/components/input";
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

// The shared field treatment, so these forms can't drift from the rest.
const inputClass = fieldClasses();

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
    <DialogFrame
      titleId="project-dialog-title"
      title={isEdit ? "Edit project" : "New project"}
      onClose={onClose}
    >
        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={project!.id} />}

          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm font-semibold">
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
            <label htmlFor="address" className="block text-sm font-semibold">
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
            <label htmlFor="status" className="block text-sm font-semibold">
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
              <label htmlFor="start_date" className="block text-sm font-semibold">
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
              <label htmlFor="end_date" className="block text-sm font-semibold">
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
            <p className="rounded-md border border-expired-line bg-expired-bg/70 px-3 py-2 text-sm text-expired">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" pending={busy}>
              {busy ? "Saving…" : isEdit ? "Save changes" : "Create project"}
            </Button>
          </div>
        </form>
    </DialogFrame>
  );
}
