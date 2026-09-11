/**
 * The "nothing here yet" panel. Dashed border rather than solid so it reads as
 * a placeholder rather than a card with content in it.
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-14 text-center ${className}`}
    >
      {Icon && (
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-ink-subtle">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
