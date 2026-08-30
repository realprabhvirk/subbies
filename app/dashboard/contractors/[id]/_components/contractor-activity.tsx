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
      <p className="rounded-card border border-line bg-surface px-5 py-8 text-center text-sm text-ink-muted">
        No activity yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-5 border-l border-line pl-6">
      {events.map((e) => {
        const Icon = ICONS[e.kind];
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface">
              <Icon
                className={`h-3.5 w-3.5 ${TONES[e.kind]}`}
                strokeWidth={2}
                aria-hidden
              />
            </span>
            <p className="text-sm font-medium">{e.title}</p>
            {e.detail && (
              <p className="mt-0.5 text-sm text-ink-muted">{e.detail}</p>
            )}
            <p className="mt-0.5 text-xs text-ink-subtle">{fmt(e.at)}</p>
          </li>
        );
      })}
    </ol>
  );
}
