import { BellRing, CalendarClock } from "lucide-react";

/**
 * A static recreation of the expiry-reminder list — same reasoning as the
 * other _components/*-preview.tsx files: real product chrome and real
 * copy, not a generic bell icon standing in for the feature.
 */
const ROWS = [
  { name: "Northside Electrical", doc: "Public liability", days: 6 },
  { name: "Apex Scaffolding", doc: "Workers compensation", days: 14 },
  { name: "BJ Plumbing & Gas", doc: "Gas fitting licence", days: 30 },
];

export function ReminderPreview() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-sm">
      <div className="flex items-center gap-2 border-b border-line bg-surface-muted px-4 py-2.5">
        <BellRing className="h-3.5 w-3.5 text-ink-subtle" strokeWidth={2} aria-hidden />
        <span className="text-xs text-ink-subtle">Reminders sent automatically</span>
      </div>
      <ul className="divide-y divide-line">
        {ROWS.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="truncate text-xs text-ink-muted">{r.doc}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-attention-bg px-2 py-0.5 text-[11px] font-medium text-attention">
              <CalendarClock className="h-3 w-3" strokeWidth={2} aria-hidden />
              {r.days}d left
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
