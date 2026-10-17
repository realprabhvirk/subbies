"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, MapPin, TriangleAlert, CircleCheck, FolderKanban } from "lucide-react";

import { StatusBadge } from "@/app/components/status-badge";
import { ButtonLink, Button } from "@/app/components/button";
import { IconButton } from "@/app/components/icon-button";
import { EmptyState } from "@/app/components/empty-state";
import { PageHeader } from "@/app/components/page-header";
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
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Which contractors are on which job, and whether everyone on site is compliant."
        actions={
          atLimit ? (
            <ButtonLink href="/dashboard/settings?tab=billing" variant="secondary">
              Upgrade to add more
            </ButtonLink>
          ) : (
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              New project
            </Button>
          )
        }
      />

      {atLimit && <LimitBanner resource="projects" limit={limit} />}

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
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
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {projects.map((p) => {
            const share =
              p.contractorCount > 0
                ? (p.contractorCount - p.issueCount) / p.contractorCount
                : 0;
            return (
              <li
                key={p.id}
                className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors hover:bg-surface-muted/70 sm:px-5 md:grid-cols-[minmax(0,1fr)_17rem_8rem_auto] md:gap-x-6"
              >
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/projects/${p.id}`}
                    className="block truncate font-semibold text-ink after:absolute after:inset-0 group-hover:text-brand focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand"
                  >
                    {p.name}
                  </Link>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-ink-muted">
                    {p.address ? (
                      <>
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-subtle" strokeWidth={2} aria-hidden />
                        <span className="truncate">{p.address}</span>
                      </>
                    ) : (
                      <span className="text-ink-subtle">No address</span>
                    )}
                  </p>
                </div>

                <div className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto">
                  <p className="flex items-center gap-1.5 whitespace-nowrap text-xs">
                    <span className="font-mono text-ink">
                      {p.contractorCount}
                    </span>
                    <span className="text-ink-muted">
                      {p.contractorCount === 1 ? "contractor" : "contractors"}
                    </span>
                    {p.issueCount > 0 ? (
                      <span className="ml-auto inline-flex items-center gap-1 font-semibold text-attention md:ml-2">
                        <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                        {p.issueCount} need attention
                      </span>
                    ) : (
                      p.contractorCount > 0 && (
                        <span className="ml-auto inline-flex items-center gap-1 font-semibold text-approved md:ml-2">
                          <CircleCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                          All compliant
                        </span>
                      )
                    )}
                  </p>
                  {p.contractorCount > 0 && (
                    <div aria-hidden className="mt-1.5 flex h-1 overflow-hidden rounded-full bg-line">
                      <div className="h-full bg-approved" style={{ width: `${Math.round(share * 100)}%` }} />
                      <div className="h-full bg-attention" style={{ width: `${Math.round((1 - share) * 100)}%` }} />
                    </div>
                  )}
                </div>

                <div className="hidden md:block">
                  <StatusBadge kind="project" status={p.status} />
                </div>

                <div className="relative z-10 col-start-2 row-start-1 flex items-center gap-1 md:col-start-auto md:row-start-auto">
                  <span className="md:hidden">
                    <StatusBadge kind="project" status={p.status} size="sm" />
                  </span>
                  <IconButton
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
                    aria-label={`Edit ${p.name}`}
                  >
                    <Pencil className="h-4 w-4" strokeWidth={2} />
                  </IconButton>
                </div>
              </li>
            );
          })}
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
