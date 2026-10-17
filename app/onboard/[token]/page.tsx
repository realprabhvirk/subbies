import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Lock, CircleCheck } from "lucide-react";

import { Logo } from "@/app/components/logo";
import { getOnboardingContext } from "@/lib/onboarding";
import { OnboardChecklist } from "./_components/onboard-checklist";

export const metadata: Metadata = {
  title: "Upload your documents",
  robots: { index: false, follow: false },
};

export default async function OnboardPage(props: PageProps<"/onboard/[token]">) {
  const { token } = await props.params;
  const context = await getOnboardingContext(token);

  if (!context) notFound();

  const { contractor, companyName, items } = context;
  const outstanding = items.filter(
    (i) => i.status === "requested" || i.status === "rejected",
  ).length;
  const allDone = outstanding === 0;
  const submitted = items.length - outstanding;

  // One segment per document, coloured by where it's at — the contractor
  // sees their progress at a glance before reading a word.
  const SEGMENT: Record<string, string> = {
    approved: "bg-approved",
    uploaded: "bg-review",
    rejected: "bg-expired",
    requested: "bg-line-strong",
  };

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-12 pt-6 sm:px-6 sm:pt-10">
      <div className="flex items-center justify-between gap-3">
        <Logo height={24} />
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          <Lock className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          Secure upload link
        </span>
      </div>

      <header className="mt-8 sm:mt-12">
        <p className="label-caps text-brand">{companyName}</p>
        <h1 className="mt-2 text-2xl sm:text-3xl">
          Documents for {contractor.businessName}
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          {companyName} needs these before work can begin. No login needed, and
          you can come back to this link any time.
        </p>
      </header>

      <section aria-label="Progress" className="mt-6">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <p className="font-semibold text-ink">
            {submitted} of {items.length} submitted
          </p>
          {!allDone && (
            <p className="text-ink-muted">
              {outstanding} still to go
            </p>
          )}
        </div>
        <div className="mt-2 flex gap-1" aria-hidden>
          {items.map((item) => (
            <span
              key={item.id}
              className={`h-1.5 flex-1 rounded-full ${SEGMENT[item.status] ?? "bg-line-strong"}`}
            />
          ))}
        </div>
      </section>

      {allDone ? (
        <div className="mt-6 flex items-start gap-3 rounded-card border border-approved-line bg-approved-bg/60 p-4 text-approved sm:p-5">
          <CircleCheck className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={2} aria-hidden />
          <div>
            <p className="font-semibold">You&apos;re all done</p>
            <p className="mt-0.5 text-sm">
              Everything requested has been submitted. You&apos;ll hear from{" "}
              {companyName} if anything needs changing.
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-ink-muted">
          PDF, JPG, PNG or HEIC, up to 15 MB each. A photo from your phone is fine.
        </p>
      )}

      <OnboardChecklist token={token} items={items} />

      <footer className="mt-10 border-t border-line pt-6 text-center text-xs text-ink-muted">
        <p>Questions? Reply to the email {companyName} sent you.</p>
        <p className="mt-2">
          Sent securely with <span className="font-semibold text-ink">Subbies</span>
        </p>
      </footer>
    </main>
  );
}
