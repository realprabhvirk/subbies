import { Lock, Upload } from "lucide-react";

import { StatusBadge } from "@/app/components/status-badge";
import type { DocumentStatus } from "@/lib/types";

/**
 * The contractor's upload page as it appears on their phone — the screen a
 * subcontractor lands on from the emailed link, with no account and no
 * login. Built from the same pieces as the real page. Example data only.
 */
const DOCS: { name: string; status: DocumentStatus }[] = [
  { name: "Public liability insurance", status: "uploaded" },
  { name: "Electrical licence", status: "requested" },
  { name: "Workers' compensation", status: "requested" },
];

export function UploadPreview() {
  return (
    <div className="mx-auto w-full max-w-[19rem] rounded-[2rem] border border-line-strong bg-warm-900 p-2 shadow-xl">
      <div className="overflow-hidden rounded-[1.6rem] bg-canvas text-left">
        <div className="flex items-center justify-between px-4 pb-1 pt-4">
          <span className="font-display text-xs font-bold stretch-wide">Subbies</span>
          <span className="flex items-center gap-1 text-2xs text-ink-muted">
            <Lock className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            Secure link
          </span>
        </div>
        <div className="px-4 pb-4 pt-3">
          <p className="label-caps text-brand">Northside Builders</p>
          <p className="mt-1 font-display text-lg font-bold leading-tight tracking-display">
            Documents for Dave&apos;s Electrical
          </p>
          <p className="mt-3 text-2xs font-semibold">1 of 3 submitted</p>
          <div className="mt-1.5 flex gap-1">
            <span className="h-1 flex-1 rounded-full bg-review" />
            <span className="h-1 flex-1 rounded-full bg-line-strong" />
            <span className="h-1 flex-1 rounded-full bg-line-strong" />
          </div>
          <ul className="mt-3 space-y-2">
            {DOCS.map((doc, i) => (
              <li key={doc.name} className="rounded-md border border-line bg-surface p-2.5">
                <p className="text-xs font-semibold leading-snug">
                  <span className="mr-1.5 font-mono text-2xs font-normal text-ink-subtle">
                    0{i + 1}
                  </span>
                  {doc.name}
                </p>
                <StatusBadge kind="document" status={doc.status} size="sm" className="mt-1.5" />
                {doc.status === "requested" && i === 1 && (
                  <div className="mt-2 flex h-9 items-center justify-center gap-1.5 rounded-sm border border-dashed border-field-line bg-surface-muted/60 text-2xs font-semibold">
                    <Upload className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                    Add a file or take a photo
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
