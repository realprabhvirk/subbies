"use client";

import { useEffect } from "react";

import { Button } from "@/app/components/button";
import { DialogFrame } from "@/app/components/dialog";

/**
 * The one confirmation dialog for anything that can't be casually undone.
 *
 * The shared DialogFrame (bottom sheet on a phone, centred panel on desktop),
 * with the safe choice made the
 * easy one: Cancel takes focus when it opens, Escape and the backdrop cancel,
 * and everything is locked while the action is running so it can't be
 * confirmed twice or dismissed half-done.
 *
 * `children` is the body — the caller says exactly what will happen, because a
 * generic "are you sure?" is how people delete things they didn't mean to.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  pendingLabel,
  tone = "danger",
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  tone?: "danger" | "primary";
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  return (
    <DialogFrame
      role="alertdialog"
      titleId="confirm-dialog-title"
      describedById="confirm-dialog-body"
      title={title}
      onClose={onClose}
      closeDisabled={pending}
    >
      <div id="confirm-dialog-body" className="text-sm text-ink-muted">
        {children}
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-expired-line bg-expired-bg/70 px-3 py-2 text-sm text-expired">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={pending}
          autoFocus
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant={tone === "danger" ? "danger" : "primary"}
          onClick={onConfirm}
          pending={pending}
        >
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </DialogFrame>
  );
}
