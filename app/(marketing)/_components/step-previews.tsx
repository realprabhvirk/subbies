import { Check, Send, X } from "lucide-react";

/*
 * Static product pictures for the step-by-step story (step 1 request and
 * step 3 review). Built from the app's own styles, example data only, each
 * labelled "Example".
 */

/** A static review decision bar — the step-3 visual. Example data. */
export function ReviewPreview() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface text-left shadow-lg">
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Public liability insurance</p>
          <p className="mt-0.5 truncate font-mono text-2xs text-ink-muted">
            certificate-of-currency.pdf
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="font-mono text-2xs text-ink-subtle">Example</span>
          <span className="rounded-sm border border-review-line bg-review-bg px-1.5 py-0.5 text-2xs font-semibold text-review">
            Awaiting review
          </span>
        </div>
      </div>
      <div className="mx-4 mb-4 rounded-md border border-review-line bg-review-bg/40 p-3">
        <p className="label-caps text-review">Your review</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div>
            <p className="text-2xs font-semibold">Expiry date</p>
            <p className="mt-1 flex h-9 w-32 items-center rounded-md border border-field-line bg-surface px-2.5 font-mono text-xs">
              30/06/2027
            </p>
          </div>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-xs font-semibold text-white">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            Approve
          </span>
          <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-xs font-semibold">
            <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            Reject
          </span>
        </div>
      </div>
    </div>
  );
}

/** The step-1 visual: an onboarding request about to be sent. Example data. */
const REQUEST_DOCS = [
  { name: "Public liability insurance", on: true },
  { name: "Electrical licence", on: true },
  { name: "Workers' compensation", on: true },
  { name: "Site induction", on: false },
];

export function RequestPreview() {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface text-left shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="text-sm font-semibold">New onboarding request</p>
        <span className="font-mono text-2xs text-ink-subtle">Example</span>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div>
          <p className="text-2xs font-semibold">Contractor</p>
          <p className="mt-1 flex h-9 items-center rounded-md border border-field-line bg-surface px-2.5 text-xs">
            Dave&apos;s Electrical
          </p>
        </div>
        <div>
          <p className="text-2xs font-semibold">Documents to request</p>
          <ul className="mt-1.5 divide-y divide-line rounded-md border border-line">
            {REQUEST_DOCS.map((d) => (
              <li key={d.name} className="flex items-center gap-2.5 px-2.5 py-2 text-xs">
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                    d.on ? "border-brand bg-brand text-white" : "border-field-line bg-surface"
                  }`}
                >
                  {d.on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className={d.on ? "" : "text-ink-muted"}>{d.name}</span>
              </li>
            ))}
          </ul>
        </div>
        <span className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-brand text-xs font-semibold text-white">
          <Send className="h-3.5 w-3.5" strokeWidth={2.25} />
          Send onboarding request
        </span>
      </div>
    </div>
  );
}

