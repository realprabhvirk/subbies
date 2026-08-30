"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { ProjectDialog, type ProjectDialogData } from "../../_components/project-dialog";

export function EditProjectButton({ project }: { project: ProjectDialogData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted"
      >
        <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
        Edit details
      </button>
      {open && (
        <ProjectDialog
          project={project}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
