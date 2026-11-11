"use client";

import { useState, useTransition } from "react";
import {
  CircleCheck,
  CircleX,
  FileUp,
  FolderPlus,
  History,
  ListChecks,
  ListX,
  Pencil,
  RefreshCw,
  ShieldAlert,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/app/components/button";
import { relativeTime } from "@/lib/relative-time";
import { COMPLIANCE_TIMEZONE } from "@/lib/time/compliance-today";
import type { ActivityEvent } from "../_lib/activity";
import { loadMoreActivity } from "../activity-actions";

const ICON: Record<string, LucideIcon> = {
  project_created: FolderPlus,
  project_updated: Pencil,
  project_completed: CircleCheck,
  contractor_assigned: UserPlus,
  contractor_removed: UserMinus,
  requirement_added: ListChecks,
  requirement_removed: ListX,
  document_uploaded: FileUp,
  document_approved: CircleCheck,
  document_rejected: CircleX,
  document_replaced: RefreshCw,
  document_expired: ShieldAlert,
  compliance_status_changed: History,
};

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: COMPLIANCE_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabelFmt = new Intl.DateTimeFormat("en-AU", { timeZone: COMPLIANCE_TIMEZONE, day: "numeric", month: "short", year: "numeric" });
const absolute = new Intl.DateTimeFormat("en-AU", { timeZone: COMPLIANCE_TIMEZONE, dateStyle: "medium", timeStyle: "short" });

function dayLabel(iso: string, now: Date): string {
  const k = dayKey.format(new Date(iso));
  if (k === dayKey.format(now)) return "Today";
  if (k === dayKey.format(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return dayLabelFmt.format(new Date(iso));
}

/** Timeline grouped by day. With a cursor it offers "Load more". */
export function ActivityFeed({
  projectId,
  initial,
  initialCursor = null,
  compact = false,
}: {
  projectId: string;
  initial: ActivityEvent[];
  initialCursor?: string | null;
  compact?: boolean;
}) {
  const [events, setEvents] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const now = new Date();

  const groups: { label: string; items: ActivityEvent[] }[] = [];
  for (const e of events) {
    const label = dayLabel(e.createdAt, now);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(e);
    else groups.push({ label, items: [e] });
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          {!compact && <h3 className="label-caps mb-2 text-ink-muted">{g.label}</h3>}
          <ol className="space-y-1">
            {g.items.map((e) => {
              const Icon = ICON[e.eventType] ?? History;
              return (
                <li key={e.id} className="flex gap-3 rounded-md py-2">
                  <span aria-hidden className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-muted text-ink-muted">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm text-ink">{e.description}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {e.actor} ·{" "}
                      <time dateTime={e.createdAt} title={absolute.format(new Date(e.createdAt))}>
                        {relativeTime(e.createdAt)}
                      </time>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {cursor && (
        <div className="flex flex-col items-start gap-2">
          <Button
            type="button"
            variant="secondary"
            pending={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await loadMoreActivity(projectId, cursor);
                if (!r.ok) return setError(r.error);
                setEvents((prev) => [...prev, ...r.events]);
                setCursor(r.nextCursor);
              })
            }
          >
            Load more
          </Button>
          {error && <p role="alert" className="text-sm text-expired">{error}</p>}
        </div>
      )}
      {!cursor && !compact && events.length > 0 && (
        <p className="text-xs text-ink-muted">That&apos;s everything recorded for this project.</p>
      )}
    </div>
  );
}
