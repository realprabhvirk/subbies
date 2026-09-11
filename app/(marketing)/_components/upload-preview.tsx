import { Paperclip } from "lucide-react";

import { Button } from "@/app/components/button";

/**
 * A static recreation of the contractor's upload screen — the page a
 * subcontractor lands on from the emailed link, with no account and no
 * login. Same reasoning as ProductPreview: this is what the product's
 * request list actually looks like, not a generic icon standing in for it.
 */
export function UploadPreview() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-line bg-surface-muted px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 text-xs text-ink-subtle">
          subbies.com/onboard/…
        </span>
      </div>
      <div className="p-5">
        <p className="text-sm font-semibold text-brand-ink">
          Northside Builders needs your documents
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Hi Dave — please upload the following before you start on site.
        </p>
        <ul className="mt-4 space-y-2">
          {["Public liability insurance", "Electrical licence", "Workers compensation"].map(
            (doc) => (
              <li
                key={doc}
                className="flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-xs"
              >
                <Paperclip
                  className="h-3.5 w-3.5 shrink-0 text-ink-subtle"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="truncate font-medium">{doc}</span>
              </li>
            ),
          )}
        </ul>
        <Button type="button" size="sm" className="mt-4 w-full" tabIndex={-1}>
          Upload your documents
        </Button>
      </div>
    </div>
  );
}
