import { LinkIcon } from "lucide-react";

import { Logo } from "@/app/components/logo";

/**
 * Shown when the company has archived this contractor. Names the company so
 * the contractor knows who to contact, and nothing else: no documents, no
 * upload controls.
 */
export function LinkInactive({ companyName }: { companyName: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-(--page-padding) pb-12 pt-6 sm:pt-10">
      <Logo size="brand" />
      <div className="flex flex-1 flex-col justify-center py-12">
        <LinkIcon className="h-8 w-8 text-ink-subtle" strokeWidth={1.75} aria-hidden />
        <h1 className="mt-5 text-2xl sm:text-3xl">This link is no longer active</h1>
        <p className="mt-3 text-sm text-ink-muted">
          {companyName} isn&apos;t collecting documents through this link any more,
          so there&apos;s nothing to upload here.
        </p>
        <p className="mt-6 rounded-card border border-line bg-surface px-4 py-3.5 text-sm">
          If you think this is a mistake, reply to the email {companyName} sent you
          and ask them for a new link.
        </p>
      </div>
    </main>
  );
}
