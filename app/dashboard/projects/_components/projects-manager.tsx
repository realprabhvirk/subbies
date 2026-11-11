"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, MapPin, TriangleAlert, CircleCheck, FolderKanban } from "lucide-react";

import { StatusBadge } from "@/app/components/status-badge";
import { Button } from "@/app/components/button";
import { IconButton } from "@/app/components/icon-button";
import { EmptyState } from "@/app/components/empty-state";
import { PageHeader } from "@/app/components/page-header";
import { LimitBanner } from "@/app/dashboard/_components/limit-banner";
import { UpgradePrompt } from "@/app/components/upgrade-prompt";
import type { PlanError } from "@/lib/billing/plans";
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
  planError = null,
}: {
  projects: ProjectListItem[];
  atLimit?: boolean;
  limit?: number | null;
  /** The server's typed error when the plan (not lapsed access) blocks adding. */
  planError?: PlanError | null;
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
          atLimit ? undefined : (
            <Button type="button" onClick={openCreate}>
              <Plus className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              New project
            </Button>
          )
        }
      />

      {atLimit &&
        (planError ? (
          <UpgradePrompt error={planError} />
        ) : (
          <LimitBanner resource="projects" limit={limit} accessLapsed />
        ))}

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create a project, then assign the contractors working on it."
          action={
            atLimit ? undefined : (
              <Button type="button" onClick={openCreate}>
                <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
                New project
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const share =
              p.contractorCount > 0
                ? (p.contractorCount - p.issueCount) / p.contractorCount
                : 0;
            return (
              <li
                key={p.id}
                className="group relative flex flex-col rounded-card border border-line bg-surface p-card shadow-sm transition-[transform,box-shadow] duration-[var(--duration-base)] hover:shadow-md motion-safe:hover:-translate-y-0.5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <StatusBadge kind="project" status={p.status} />
                  <div className="relative z-10 -mr-2 -mt-2">
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
                </div>

                {/* The name is the link, stretched over the whole card, so the
                    card is one real anchor; the edit button sits above it. */}
                <Link
                  href={`/dashboard/projects/${p.id}`}
                  className="mt-4 block font-display text-card-title font-semibold leading-tight text-ink after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-brand"
                >
                  <span className="line-clamp-2 break-words">{p.name}</span>
                </Link>
                <p className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
                  {p.address ? (
                    <>
                      <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" strokeWidth={2} aria-hidden />
                      <span className="line-clamp-2">{p.address}</span>
                    </>
                  ) : (
                    <span className="text-ink-subtle">No address</span>
                  )}
                </p>

                <div className="mt-auto pt-6">
                  <div className="border-t border-line pt-4">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <span className="font-mono text-sm font-medium text-ink">{p.contractorCount}</span>
                      <span className="text-ink-muted">
                        {p.contractorCount === 1 ? "contractor" : "contractors"}
                      </span>
                      {p.issueCount > 0 ? (
                        <span className="ml-auto inline-flex items-center gap-1.5 font-semibold text-attention">
                          <TriangleAlert className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                          {p.issueCount} need attention
                        </span>
                      ) : (
                        p.contractorCount > 0 && (
                          <span className="ml-auto inline-flex items-center gap-1.5 font-semibold text-approved">
                            <CircleCheck className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                            All compliant
                          </span>
                        )
                      )}
                    </p>
                    {p.contractorCount > 0 && (
                      <div aria-hidden className="mt-3 flex h-2 overflow-hidden rounded-full bg-line">
                        <div className="h-full bg-tile-approved-disc" style={{ width: `${Math.round(share * 100)}%` }} />
                        <div className="h-full bg-tile-expiring-disc" style={{ width: `${Math.round((1 - share) * 100)}%` }} />
                      </div>
                    )}
                  </div>
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
