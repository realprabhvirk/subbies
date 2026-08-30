import { Hammer } from "lucide-react";

export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
      </header>

      <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
        <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-ink-subtle">
          <Hammer className="h-5 w-5" strokeWidth={2} aria-hidden />
        </span>
        <p className="text-sm font-medium">This section is being built</p>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>
      </div>
    </div>
  );
}
