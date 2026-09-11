"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, MapPin, Users, TriangleAlert } from "lucide-react";

import { StatusBadge } from "@/app/components/status-badge";
import { ButtonLink, Button } from "@/app/components/button";
import { EmptyState } from "@/app/components/empty-state";
import { LimitBanner } from "@/app/dashboard/_components/limit-banner";
import type { ProjectStatus } from "@/lib/types";
import { ProjectDialog, type ProjectDialogData } from "./project-dialog";

export interface ProjectListItem {
  id: string;
  name: string;
  address: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  contractorCount: number;
  issueCount: number;
}

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; project: ProjectDialogData }
  | null;

export function ProjectsManager({
  projects,
  atLimit = false,
  limit = null,
}: {
  projects: ProjectListItem[];
  atLimit?: boolean;
  limit?: number | null;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);

  const openCreate = () => setDialog({ mode: "create" });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-muted">
            Track which contractors are on which job, and see at a glance whether
            everyone on site is compliant.
          </p>
        </div>
        {atLimit ? (
          <ButtonLink
            href="/dashboard/settings?tab=billing"
            variant="secondary"
            className="shrink-0"
          >
            Upgrade to add more
          </ButtonLink>
        ) : (
          <Button type="button" onClick={openCreate} className="shrink-0">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            New project
          </Button>
        )}
      </header>

      {atLimit && <LimitBanner resource="projects" limit={limit} />}

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project, then assign the contractors working on it."
          action={
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              New project
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex flex-col rounded-card border border-line bg-surface shadow-sm p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/dashboard/projects/${p.id}`}
                  className="text-base font-semibold hover:text-brand hover:underline"
                >
                  {p.name}
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <StatusBadge kind="project" status={p.status} />
                  <button
                    type="button"
                    onClick={() =>
                      setDialog({
                        mode: "edit",
                        project: {
                          id: p.id,
                          name: p.name,
                          address: p.address,
                          status: p.status,
                          startDate: p.startDate,
                          endDate: p.endDate,
                        },
                      })
                    }
                    className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {p.address && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
                  <MapPin className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  {p.address}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <Users className="h-4 w-4" strokeWidth={2} aria-hidden />
                  {p.contractorCount}{" "}
                  {p.contractorCount === 1 ? "contractor" : "contractors"}
                </span>
                {p.issueCount > 0 ? (
                  <span className="flex items-center gap-1.5 font-medium text-attention">
                    <TriangleAlert className="h-4 w-4" strokeWidth={2} aria-hidden />
                    {p.issueCount} need attention
                  </span>
                ) : (
                  p.contractorCount > 0 && (
                    <span className="text-approved">All compliant</span>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {dialog && (
        <ProjectDialog
          key={dialog.mode === "edit" ? dialog.project.id : "create"}
          project={dialog.mode === "edit" ? dialog.project : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
