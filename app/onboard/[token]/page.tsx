import type { Metadata } from "next";
import { notFound } from "next/navigation";

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

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
      <Logo className="mb-8" />

      <div className="rounded-card border border-line bg-surface shadow-sm p-6 sm:p-8">
        <p className="text-sm font-medium text-brand">{companyName}</p>
        <h1 className="mt-1 text-xl font-semibold">
          Compliance documents for {contractor.businessName}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {companyName} needs the documents below before work can begin. This
          page is unique to you. No login required. You can come back to this
          link any time.
        </p>

        <div
          className={`mt-5 rounded-md px-4 py-3 text-sm ${
            allDone
              ? "bg-approved-bg text-approved"
              : "bg-surface-muted text-ink-muted"
          }`}
        >
          {allDone
            ? "Everything requested has been submitted. There's nothing more to do right now. You'll hear from " +
              companyName +
              " if anything needs changing."
            : `${outstanding} ${outstanding === 1 ? "document" : "documents"} still to upload. Accepted formats: PDF, JPG, PNG, HEIC (max 15 MB).`}
        </div>

        <OnboardChecklist token={token} items={items} />
      </div>

      <p className="mt-6 text-center text-xs text-ink-subtle">
        Questions? Reply to the email {companyName} sent you.
      </p>
    </main>
  );
}
