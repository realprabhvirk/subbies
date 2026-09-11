import { X } from "lucide-react";

/**
 * A small removable tag — same pill shape as StatusBadge (rounded-full,
 * px-2.5 py-1, text-xs) but neutral rather than a status colour, since a
 * day count or filter value isn't a compliance status.
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
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="-mr-1 rounded-full p-0.5 text-ink-subtle transition-colors hover:bg-line-strong hover:text-ink"
        >
          <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </span>
  );
}
