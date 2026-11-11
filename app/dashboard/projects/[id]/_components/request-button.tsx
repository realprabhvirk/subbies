"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { Button } from "@/app/components/button";
import { requestProjectDocument } from "../workspace-actions";

/** "Request" on a missing, expired or rejected requirement: the existing email flow. */
export function RequestButton({
  projectId,
  contractorId,
  documentTypeId,
  label = "Request",
}: {
  projectId: string;
  contractorId: string;
  documentTypeId: string | null;
  label?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        pending={pending}
        onClick={() =>
          start(async () => {
            const r = await requestProjectDocument(projectId, contractorId, documentTypeId);
            setNote(r.ok ? { ok: true, text: r.message ?? "Request sent." } : { ok: false, text: r.error });
            if (r.ok) router.refresh();
          })
        }
      >
        <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
        {label}
      </Button>
      {note && (
        <span role={note.ok ? "status" : "alert"} className={`max-w-56 text-right text-2xs ${note.ok ? "text-ink-muted" : "text-expired"}`}>
          {note.text}
        </span>
      )}
    </span>
  );
}
