"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StickyNote, Trash2 } from "lucide-react";

import { Alert } from "@/app/components/alert";
import { Button } from "@/app/components/button";
import { ConfirmDialog } from "@/app/components/confirm-dialog";
import { IconButton } from "@/app/components/icon-button";
import { fieldClasses } from "@/app/components/input";
import { MAX_NOTE_LENGTH, validateNoteBody } from "@/lib/contractor-notes-logic";
import {
  addContractorNote,
  deleteContractorNote,
  type NoteView,
} from "../notes-actions";

/**
 * Private notes about a contractor, newest first. Only the company ever sees
 * these: they are never shown on the contractor's upload page or put in an
 * email, and the copy here says so, because "who can read this?" is the first
 * thing anyone wonders before typing something candid.
 */
export function NotesPanel({
  contractorId,
  initialNotes,
}: {
  contractorId: string;
  initialNotes: NoteView[];
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<NoteView | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setError(null);

    const checked = validateNoteBody(draft);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }

    startTransition(async () => {
      const result = await addContractorNote(contractorId, draft);
      if (!result.ok) {
        // The draft is kept, so a failed save never costs someone their text.
        setError(result.error);
        return;
      }
      setNotes((prev) => [result.note, ...prev]);
      setDraft("");
      router.refresh();
    });
  };

  const confirmDelete = () => {
    if (!deleting) return;
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteContractorNote(deleting.id);
      if (!result.ok) {
        setDeleteError(result.error ?? "Couldn't delete the note.");
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== deleting.id));
      setDeleting(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={add}
        noValidate
        className="rounded-card border border-line bg-surface p-card sm:p-6"
      >
        <label htmlFor="note-body" className="text-base font-semibold">
          Add a note
        </label>
        <p className="mt-0.5 text-sm text-ink-muted">
          Private to your business. Contractors never see notes, and they&apos;re never
          included in emails.
        </p>

        <textarea
          id="note-body"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          rows={3}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="e.g. Spoke to Sam, insurance renewal is due next week."
          aria-invalid={error ? true : undefined}
          className={`mt-4 ${fieldClasses(Boolean(error))}`}
        />

        {error && (
          <Alert tone="error" className="mt-3">
            {error}
          </Alert>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-mono text-2xs text-ink-subtle">
            {draft.length.toLocaleString("en-AU")} / {MAX_NOTE_LENGTH.toLocaleString("en-AU")}
          </span>
          <Button type="submit" disabled={draft.trim().length === 0} pending={pending && !deleting}>
            {pending && !deleting ? "Saving…" : "Add note"}
          </Button>
        </div>
      </form>

      <section>
        <h2 className="text-lg">
          History{notes.length > 0 && <span className="ml-2 align-middle font-mono text-sm font-medium text-ink-muted">{notes.length}</span>}
        </h2>

        {notes.length === 0 ? (
          <div className="mt-3 flex flex-col items-center rounded-card border border-dashed border-line-strong px-6 py-12 text-center">
            <StickyNote className="mb-4 h-7 w-7 text-ink-subtle" strokeWidth={1.75} aria-hidden />
            <p className="font-display text-lg font-semibold">No notes yet</p>
            <p className="mt-1 max-w-sm text-sm text-ink-muted">
              Add one above. The newest note is always at the top.
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {notes.map((note) => (
              <li key={note.id} className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap break-words text-sm">{note.body}</p>
                  <p className="mt-1.5 font-mono text-2xs text-ink-subtle">{note.createdLabel}</p>
                </div>
                <IconButton
                  tone="danger"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleting(note);
                  }}
                  disabled={pending}
                  aria-label="Delete note"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      {deleting && (
        <ConfirmDialog
          title="Delete this note?"
          confirmLabel="Delete note"
          pendingLabel="Deleting…"
          pending={pending}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          <p className="line-clamp-3 whitespace-pre-wrap break-words italic">
            &ldquo;{deleting.body}&rdquo;
          </p>
          <p className="mt-2">It&apos;s permanently deleted and can&apos;t be recovered.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
