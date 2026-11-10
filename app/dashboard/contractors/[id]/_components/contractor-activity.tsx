import {
  UserPlus,
  FileClock,
  Upload,
  CircleCheck,
  CircleX,
  FolderPlus,
  FolderMinus,
  type LucideIcon,
} from "lucide-react";

import type { ActivityEvent, ActivityKind } from "@/lib/contractor-activity";

const ICONS: Record<ActivityKind, LucideIcon> = {
  added: UserPlus,
  requested: FileClock,
  uploaded: Upload,
  approved: CircleCheck,
  rejected: CircleX,
  assigned: FolderPlus,
  unassigned: FolderMinus,
};

const TONES: Record<ActivityKind, string> = {
  added: "text-ink-subtle",
  requested: "text-ink-subtle",
  uploaded: "text-review",
  approved: "text-approved",
  rejected: "text-expired",
  assigned: "text-review",
  unassigned: "text-ink-subtle",
};

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ContractorActivity({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="border-t border-line px-card py-10 text-center text-sm text-ink-muted sm:px-6">
        No activity yet.
      </p>
    );
  }

  return (
    // A ruled log: timestamp in mono on the left (above on a phone), the
    // event on the right, each entry marked with its icon on the rule.
    <ol className="divide-y divide-line border-t border-line">
      {events.map((e) => {
        const Icon = ICONS[e.kind];
        return (
          <li
            key={e.id}
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 px-card py-4 sm:grid-cols-[11rem_auto_minmax(0,1fr)] sm:gap-x-4 sm:px-6"
          >
            <p className="col-span-2 font-mono text-2xs text-ink-muted sm:col-span-1 sm:pt-1.5 sm:text-xs">
              {fmt(e.at)}
            </p>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface-muted">
              <Icon
                className={`h-4 w-4 ${TONES[e.kind]}`}
                strokeWidth={2.25}
                aria-hidden
              />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{e.title}</p>
              {e.detail && (
                <p className="mt-0.5 text-sm text-ink-muted">{e.detail}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
