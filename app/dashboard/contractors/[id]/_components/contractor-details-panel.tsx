"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";

import { Alert } from "@/app/components/alert";
import { Button } from "@/app/components/button";
import { ConfirmDialog } from "@/app/components/confirm-dialog";
import { Field, fieldClasses } from "@/app/components/input";
import {
  detailsChanged,
  validateContractorDetails,
  type ContractorDetailsFieldErrors,
  type ContractorDetailsInput,
} from "@/lib/contractor-details-logic";
import { deleteContractor, updateContractorDetails } from "../manage-actions";

export interface DeletionCounts {
  /** Every document row, archived and pending replacements included. */
  documents: number;
  files: number;
  projects: number;
  notes: number;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Edit form + delete for one contractor. Save stays disabled until something
 * actually differs from what's stored; the same validation the server runs
 * gives instant feedback, but the server's answer is the one that counts.
 */
export function ContractorDetailsPanel({
  contractorId,
  initial,
  counts,
}: {
  contractorId: string;
  /** What's currently saved. ABN already formatted for display. */
  initial: ContractorDetailsInput;
  counts: DeletionCounts;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [form, setForm] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<ContractorDetailsFieldErrors>({});
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const dirty = detailsChanged(form, saved);

  const set = (key: keyof ContractorDetailsInput) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    // Editing again retires the previous result rather than leaving a stale
    // "Saved" (or an old error) sitting next to changed values.
    setStatus(null);
    setFieldErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty || pending) return;
    setStatus(null);

    const check = validateContractorDetails(form);
    if (!check.ok) {
      setFieldErrors(check.fieldErrors);
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result = await updateContractorDetails(contractorId, form);
      if (!result.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        setStatus({
          ok: false,
          text: result.error ?? "Fix the highlighted fields and try again.",
        });
        return;
      }
      // Take back the canonical form (trimmed, ABN re-spaced) the server saved.
      setSaved(result.saved);
      setForm(result.saved);
      setStatus({ ok: true, text: "Details saved." });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={submit}
        noValidate
        className="rounded-card border border-line bg-surface p-5 shadow-sm sm:p-6"
      >
        <h2 className="text-base font-semibold">Contact and business details</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Where requests are sent and how this contractor is identified.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Business name" htmlFor="cd-business" error={fieldErrors.businessName}>
            <input
              id="cd-business"
              type="text"
              autoComplete="off"
              maxLength={120}
              value={form.businessName}
              onChange={set("businessName")}
              aria-invalid={fieldErrors.businessName ? true : undefined}
              className={fieldClasses(Boolean(fieldErrors.businessName))}
            />
          </Field>

          <Field
            label={
              <>
                Contact name <span className="font-normal text-ink-subtle">(optional)</span>
              </>
            }
            htmlFor="cd-contact"
            error={fieldErrors.contactName}
          >
            <input
              id="cd-contact"
              type="text"
              autoComplete="off"
              maxLength={120}
              value={form.contactName}
              onChange={set("contactName")}
              aria-invalid={fieldErrors.contactName ? true : undefined}
              className={fieldClasses(Boolean(fieldErrors.contactName))}
            />
          </Field>

          <Field label="Email" htmlFor="cd-email" error={fieldErrors.email}>
            <input
              id="cd-email"
              type="email"
              autoComplete="off"
              value={form.email}
              onChange={set("email")}
              aria-invalid={fieldErrors.email ? true : undefined}
              className={fieldClasses(Boolean(fieldErrors.email))}
            />
          </Field>

          <Field
            label={
              <>
                Phone <span className="font-normal text-ink-subtle">(optional)</span>
              </>
            }
            htmlFor="cd-phone"
            error={fieldErrors.phone}
          >
            <input
              id="cd-phone"
              type="tel"
              autoComplete="off"
              maxLength={40}
              value={form.phone}
              onChange={set("phone")}
              aria-invalid={fieldErrors.phone ? true : undefined}
              className={fieldClasses(Boolean(fieldErrors.phone))}
            />
          </Field>

          <Field
            label={
              <>
                ABN <span className="font-normal text-ink-subtle">(optional)</span>
              </>
            }
            htmlFor="cd-abn"
            hint="11 digits. Spaces are fine."
            error={fieldErrors.abn}
          >
            <input
              id="cd-abn"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="12 345 678 901"
              value={form.abn}
              onChange={set("abn")}
              aria-invalid={fieldErrors.abn ? true : undefined}
              className={fieldClasses(Boolean(fieldErrors.abn))}
            />
          </Field>
        </div>

        {status && (
          <Alert tone={status.ok ? "success" : "error"} className="mt-5">
            {status.text}
          </Alert>
        )}

        <div className="mt-5 flex items-center justify-end gap-3">
          {!dirty && !status && (
            <span className="text-sm text-ink-subtle">No unsaved changes</span>
          )}
          <Button type="submit" disabled={!dirty} pending={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <div className="rounded-card border border-expired-line bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <TriangleAlert
            className="mt-0.5 h-5 w-5 shrink-0 text-expired"
            strokeWidth={2}
            aria-hidden
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-expired">Delete contractor</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Permanently removes {saved.businessName}, their documents and uploaded
              files, and switches off their upload link. This can&apos;t be undone.
            </p>
            <Button
              type="button"
              variant="danger-outline"
              onClick={() => setConfirmingDelete(true)}
              className="mt-4"
            >
              Delete contractor
            </Button>
          </div>
        </div>
      </div>

      {confirmingDelete && (
        <DeleteDialog
          contractorId={contractorId}
          name={saved.businessName}
          counts={counts}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

function DeleteDialog({
  contractorId,
  name,
  counts,
  onClose,
}: {
  contractorId: string;
  name: string;
  counts: DeletionCounts;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteContractor(contractorId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Stays in its pending state through the navigation, so the button
      // can't be clicked twice on the way out.
      router.replace(
        `/dashboard/contractors?deleted=${encodeURIComponent(result.name)}`,
      );
    });
  };

  return (
    <ConfirmDialog
      title={`Delete ${name}?`}
      confirmLabel="Delete contractor"
      pendingLabel="Deleting…"
      pending={pending}
      error={error}
      onConfirm={confirm}
      onClose={onClose}
    >
      <p>This permanently deletes:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Their contact and business details</li>
        {counts.documents > 0 && (
          <li>
            {plural(counts.documents, "document")} (including any archived)
            {counts.files > 0 &&
              `, and ${plural(counts.files, "uploaded file")} removed from storage`}
          </li>
        )}
        {counts.notes > 0 && <li>{plural(counts.notes, "private note")}</li>}
        <li>Their upload link, which stops working immediately</li>
        {counts.projects > 0 && (
          <li>
            Their assignments to {plural(counts.projects, "project")}. The projects
            themselves stay.
          </li>
        )}
      </ul>
      <p className="mt-3 font-medium text-ink">This can&apos;t be undone.</p>
    </ConfirmDialog>
  );
}
