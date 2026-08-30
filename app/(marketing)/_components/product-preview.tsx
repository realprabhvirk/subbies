import { CircleCheck, Clock, TriangleAlert } from "lucide-react";

/**
 * A static, stylised snapshot of the dashboard — used instead of a stock
 * illustration so the marketing site shows the actual product.
 */
const ROWS = [
  {
    name: "Northside Electrical",
    trade: "Electrical",
    label: "Approved",
    icon: CircleCheck,
    cls: "text-approved bg-approved-bg border-approved-line",
  },
  {
    name: "BJ Plumbing & Gas",
    trade: "Plumbing",
    label: "Awaiting review",
    icon: Clock,
    cls: "text-review bg-review-bg border-review-line",
  },
  {
    name: "Apex Scaffolding",
    trade: "Scaffolding",
    label: "Attention required",
    icon: TriangleAlert,
    cls: "text-attention bg-attention-bg border-attention-line",
  },
];

export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-line bg-surface-muted px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 text-xs text-ink-subtle">Contractors</span>
      </div>

      <div className="grid grid-cols-3 gap-px border-b border-line bg-line">
        {[
          { k: "Approved", v: "18" },
          { k: "Awaiting review", v: "3" },
          { k: "Expiring soon", v: "2" },
        ].map((s) => (
          <div key={s.k} className="bg-surface px-4 py-3">
            <p className="text-xs text-ink-muted">{s.k}</p>
            <p className="mt-1 text-xl font-semibold text-brand-ink">{s.v}</p>
          </div>
        ))}
      </div>

      <ul className="divide-y divide-line">
        {ROWS.map((r) => {
          const Icon = r.icon;
          return (
            <li
              key={r.name}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="truncate text-xs text-ink-muted">{r.trade}</p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${r.cls}`}
              >
                <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
                {r.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
