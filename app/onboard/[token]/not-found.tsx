import { LinkIcon } from "lucide-react";

import { Logo } from "@/app/components/logo";

export default function OnboardNotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-12 pt-6 sm:px-6 sm:pt-10">
      <Logo height={24} />
      <div className="flex flex-1 flex-col justify-center py-12">
        <LinkIcon className="h-8 w-8 text-ink-subtle" strokeWidth={1.75} aria-hidden />
        <h1 className="mt-5 text-2xl sm:text-3xl">This link isn&apos;t valid</h1>
        <p className="mt-3 text-sm text-ink-muted">
          The upload link may have expired or been mistyped.
        </p>
        <ol className="mt-6 divide-y divide-line rounded-card border border-line bg-surface text-sm">
          <li className="flex gap-3 px-4 py-3.5">
            <span className="font-mono text-xs text-ink-subtle">01</span>
            Open the most recent email from the company that asked for your
            documents and use the link in that one.
          </li>
          <li className="flex gap-3 px-4 py-3.5">
            <span className="font-mono text-xs text-ink-subtle">02</span>
            Still not working? Reply to that email and ask them to send a new
            link.
          </li>
        </ol>
      </div>
    </main>
  );
}
