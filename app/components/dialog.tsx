"use client";

import { X } from "lucide-react";

import { IconButton } from "@/app/components/icon-button";

/**
 * The one dialog frame: scrim, panel, title row with a close button. A
 * bottom sheet on a phone (thumb-reachable, full width), a centred panel from
 * the sm breakpoint up.
 *
 * Purely the visual shell. Each dialog keeps its own behaviour — Escape
 * handling, what closing is allowed to do mid-save, focus — because those
 * genuinely differ between a form and a destructive confirmation.
 */
export function DialogFrame({
  titleId,
  title,
  description,
  describedById,
  role = "dialog",
  onClose,
  closeDisabled = false,
  size = "md",
  children,
}: {
  titleId: string;
  title: React.ReactNode;
  /** Optional one-line sub under the title. */
  description?: React.ReactNode;
  /** id of the element describing the dialog (for aria-describedby). */
  describedById?: string;
  role?: "dialog" | "alertdialog";
  /** Backdrop click and the close button. */
  onClose: () => void;
  /** Locks the backdrop and close button (e.g. while an action runs). */
  closeDisabled?: boolean;
  size?: "md" | "lg";
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="dialog-backdrop absolute inset-0 bg-warm-900/45"
        onClick={closeDisabled ? undefined : onClose}
      />
      <div
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedById}
        className={`dialog-panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border border-line bg-surface shadow-xl sm:rounded-xl ${
          size === "lg" ? "sm:max-w-xl" : "sm:max-w-md"
        }`}
      >
        {/* Grab handle: a visual cue that this is a sheet on a phone. */}
        <span
          aria-hidden
          className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden"
        />
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-1 pt-4 sm:px-6 sm:pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-ink-muted">{description}</p>
            )}
          </div>
          <IconButton
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close"
            className="-mr-2 -mt-1.5"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 pb-5 pt-3 sm:px-6 sm:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
