"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { Button } from "@/app/components/button";
import { ProjectDialog, type ProjectDialogData } from "../../_components/project-dialog";

export function EditProjectButton({ project }: { project: ProjectDialogData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
        Edit details
      </Button>
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
