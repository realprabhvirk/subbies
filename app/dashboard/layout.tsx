import { requireUser, getCompany } from "@/lib/supabase/dal";
import { Logo } from "@/app/components/logo";
import { SignOutButton } from "./_components/sign-out-button";
import { DashboardShell } from "./_components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  await requireUser();
  const company = await getCompany();

  if (!company) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 shadow-sm">
          <Logo className="mb-6" />
          <h1 className="text-lg font-semibold">Account setup incomplete</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Your login exists but it isn&apos;t linked to a company yet. Sign out
            and sign up again, or contact support if this keeps happening.
          </p>
          <div className="mt-6">
            <SignOutButton variant="inline" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <DashboardShell companyName={company.name}>{children}</DashboardShell>
  );
}
