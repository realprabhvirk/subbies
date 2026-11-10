import { X } from "lucide-react";

/**
 * A small removable tag — a pill like the status pill but
 * neutral, since a day count or filter value isn't a compliance status.
 */
export function Chip({
  children,
  onRemove,
  removeLabel = "Remove",
}: {
  children: React.ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface-muted px-3 text-xs font-medium text-ink">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="relative -mr-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-line-strong hover:text-ink"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </span>
  );
}
