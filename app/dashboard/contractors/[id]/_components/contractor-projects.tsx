import Link from "next/link";
import { FolderKanban } from "lucide-react";

import { StatusBadge } from "@/app/components/status-badge";
import type { ProjectStatus } from "@/lib/types";

export interface ContractorProjectItem {
  assignmentId: string;
  projectId: string;
  projectName: string;
  projectStatus: ProjectStatus;
  role: string | null;
  assignedAt: string;
  removedAt: string | null;
}

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function ContractorProjects({
  projects,
}: {
  projects: ContractorProjectItem[];
}) {
  const current = projects.filter((p) => !p.removedAt);
  const past = projects.filter((p) => p.removedAt);

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-card border border-dashed border-line-strong px-6 py-12 text-center">
        <FolderKanban className="mb-4 h-7 w-7 text-ink-subtle" strokeWidth={1.75} aria-hidden />
        <p className="font-display text-lg font-semibold">Not on any projects</p>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">
          Assign this contractor to a project from the project&apos;s page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {current.length > 0 && (
        <Group title="Current" items={current} fmt={fmt} />
      )}
      {past.length > 0 && <Group title="Past" items={past} fmt={fmt} muted />}
    </div>
  );
}

function Group({
  title,
  items,
  fmt,
  muted = false,
}: {
  title: string;
  items: ContractorProjectItem[];
  fmt: (iso: string) => string;
  muted?: boolean;
}) {
  return (
    <div>
      <h3 className="label-caps text-ink-muted">{title}</h3>
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
        {items.map((p) => (
          <li
            key={p.assignmentId}
            className={`flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5 ${
              muted ? "opacity-70" : ""
            }`}
          >
            <div className="min-w-0">
              <Link
                href={`/dashboard/projects/${p.projectId}`}
                className="font-semibold hover:text-brand hover:underline"
              >
                {p.projectName}
              </Link>
              <p className="truncate text-sm text-ink-muted">
                {p.role ? `${p.role} · ` : ""}
                {p.removedAt
                  ? `${fmt(p.assignedAt)} – ${fmt(p.removedAt)}`
                  : `Assigned ${fmt(p.assignedAt)}`}
              </p>
            </div>
            <StatusBadge kind="project" status={p.projectStatus} />
          </li>
        ))}
      </ul>
    </div>
  );
}
