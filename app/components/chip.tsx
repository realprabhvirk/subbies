import { X } from "lucide-react";

/**
 * A small removable tag — same squared shape as the status stamp but
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
    <span className="inline-flex items-center gap-1 rounded-sm border border-line-strong bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="-mr-1 rounded-sm p-0.5 text-ink-muted transition-colors hover:bg-line-strong hover:text-ink"
        >
          <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </span>
  );
}
