/**
 * The "nothing here yet" panel. A dashed rule rather than a solid one so it
 * reads as a space waiting to be filled, not a panel with content. Left-set
 * on wide screens like the rest of the product; the icon sits bare, in the
 * subtle ink, rather than in a decorative circle.
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
      className={`rounded-card border border-dashed border-line-strong px-6 py-12 sm:px-10 ${className}`}
    >
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        {Icon && (
          <Icon className="mb-4 h-7 w-7 text-ink-subtle" strokeWidth={1.75} />
        )}
        <p className="font-display text-lg font-semibold text-ink">{title}</p>
        {description && (
          <p className="mt-1.5 text-sm text-ink-muted">{description}</p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}
