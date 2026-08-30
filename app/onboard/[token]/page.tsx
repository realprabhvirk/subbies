import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Logo } from "@/app/components/logo";
import { StatusBadge } from "@/app/components/status-badge";
import { getOnboardingContext } from "@/lib/onboarding";

export const metadata: Metadata = {
  title: "Upload your documents",
  robots: { index: false, follow: false },
};

export default async function OnboardPage(
  props: PageProps<"/onboard/[token]">,
) {
  const { token } = await props.params;
  const context = await getOnboardingContext(token);

  if (!context) notFound();

  const { contractor, companyName, items } = context;
  const outstanding = items.filter(
    (i) => i.status === "requested" || i.status === "rejected",
  ).length;

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:py-16">
      <Logo className="mb-8" />

      <div className="rounded-card border border-line bg-surface p-6 sm:p-8">
        <p className="text-sm font-medium text-brand">{companyName}</p>
        <h1 className="mt-1 text-xl font-semibold">
          Compliance documents for {contractor.businessName}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {companyName} needs the documents below before work can begin. This
          page is unique to you — no login required.
        </p>

        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-line p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{item.documentName}</span>
                <StatusBadge kind="document" status={item.status} />
              </div>
              {item.status === "rejected" && item.rejectionReason && (
                <p className="mt-2 text-sm text-expired">
                  Not accepted: {item.rejectionReason}
                </p>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-md bg-surface-muted px-4 py-3 text-sm text-ink-muted">
          {outstanding > 0
            ? "The upload step is being finalised. You'll be able to add each document here shortly — this link stays valid."
            : "Everything requested has been submitted. There's nothing more to do right now."}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-ink-subtle">
        Questions? Reply to the email {companyName} sent you.
      </p>
    </main>
  );
}
