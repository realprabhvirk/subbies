"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { Button } from "@/app/components/button";
import { IconButton } from "@/app/components/icon-button";

/**
 * The one confirmation dialog for anything that can't be casually undone.
 *
 * Same shell as the project dialog (bottom sheet on a phone, centred modal on
 * desktop, the shared backdrop/panel motion), with the safe choice made the
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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="dialog-backdrop absolute inset-0 bg-warm-900/40 backdrop-blur-[2px]"
        onClick={pending ? undefined : onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        className="dialog-panel relative w-full max-w-md rounded-t-card border border-line bg-surface p-6 shadow-xl sm:rounded-card"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="confirm-dialog-title" className="text-lg font-semibold">
            {title}
          </h2>
          <IconButton onClick={onClose} disabled={pending} aria-label="Close">
            <X className="h-5 w-5" strokeWidth={2} />
          </IconButton>
        </div>

        <div id="confirm-dialog-body" className="mt-3 text-sm text-ink-muted">
          {children}
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-expired-bg px-3 py-2 text-sm text-expired">
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
      </div>
    </div>
  );
}
