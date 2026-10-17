import { BellRing, Check } from "lucide-react";

/**
 * The expiry-reminder schedule as the product runs it — documents coming
 * due, days left in mono, and the reminders already sent. Example data only.
 */
const ROWS = [
  { name: "Northside Electrical", doc: "Public liability", days: 6, sent: "30d · 14d · 7d" },
  { name: "Apex Scaffolding", doc: "Workers' compensation", days: 14, sent: "30d · 14d" },
  { name: "BJ Plumbing & Gas", doc: "Gas fitting licence", days: 30, sent: "30d" },
];

export function ReminderPreview() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface text-left shadow-lg">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="label-caps flex items-center gap-1.5 text-ink-muted">
          <BellRing className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          Expiring in the next 30 days
        </p>
        <span className="font-mono text-2xs text-ink-subtle">Example</span>
      </div>
      <ul className="divide-y divide-line">
        {ROWS.map((r) => (
          <li key={r.name} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.name}</p>
              <p className="truncate text-xs text-ink-muted">{r.doc}</p>
              <p className="mt-1 flex items-center gap-1 text-2xs text-approved">
                <Check className="h-3 w-3" strokeWidth={2.75} aria-hidden />
                Reminded at <span className="font-mono">{r.sent}</span>
              </p>
            </div>
            <span
              className={`shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-xs font-medium ${
                r.days <= 7
                  ? "border-attention-line bg-attention-bg text-attention"
                  : "border-line-strong bg-surface-muted text-ink-muted"
              }`}
            >
              {r.days}d
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
