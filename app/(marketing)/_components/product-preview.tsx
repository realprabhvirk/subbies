import { CircleCheck, ChevronRight } from "lucide-react";

import { StatusBadge } from "@/app/components/status-badge";
import type { ContractorStatus } from "@/lib/types";

/**
 * A static snapshot of the contractor register, built from the app's own
 * components (the same status stamps, figures and rules) so the marketing
 * site shows the actual product rather than an illustration of one.
 * Example data only.
 */
const ROWS: { name: string; trade: string; docs: string; status: ContractorStatus }[] = [
  { name: "Redline Concreting", trade: "Concreter", docs: "2/2", status: "expired" },
  { name: "Apex Scaffolding", trade: "Scaffolder", docs: "3/4", status: "attention_required" },
  { name: "BJ Plumbing & Gas", trade: "Plumber", docs: "1/3", status: "awaiting_review" },
  { name: "Northside Electrical", trade: "Electrician", docs: "3/3", status: "approved" },
];

export function ProductPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface text-left shadow-lg">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="label-caps text-ink-muted">Apex Build Group / Dashboard</p>
        <span className="font-mono text-2xs text-ink-subtle">Example</span>
      </div>

      {!compact && (
        <div className="grid grid-cols-[1.4fr_1fr_1fr] border-b border-line">
          <div className="border-r border-line px-4 py-3.5">
            <p className="label-caps flex items-center gap-1 text-ink-muted">
              <CircleCheck className="h-3 w-3 text-approved" strokeWidth={2.5} aria-hidden />
              Approved
            </p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="figure text-3xl">18</span>
              <span className="text-xs text-ink-muted">of 24</span>
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-sm bg-line">
              <div className="h-full w-3/4 bg-approved" />
            </div>
          </div>
          <div className="border-r border-line px-4 py-3.5">
            <p className="label-caps text-ink-muted">Expiring</p>
            <p className="figure mt-2 text-3xl text-attention">2</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="label-caps text-ink-muted">Expired</p>
            <p className="figure mt-2 text-3xl text-expired">1</p>
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between px-4 pb-2 pt-4">
        <p className="font-display text-base font-semibold">Needs you</p>
        <p className="text-2xs text-ink-subtle">Most urgent first</p>
      </div>
      <ul className="divide-y divide-line border-t border-line">
        {ROWS.map((r) => (
          <li key={r.name} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.name}</p>
              <p className="truncate text-xs text-ink-muted">
                {r.trade} · <span className="font-mono">{r.docs}</span> approved
              </p>
            </div>
            <StatusBadge kind="contractor" status={r.status} size="sm" />
            <ChevronRight className="hidden h-4 w-4 text-ink-subtle sm:block" strokeWidth={2} aria-hidden />
          </li>
        ))}
      </ul>
    </div>
  );
}
