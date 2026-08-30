import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { getUser } from "@/lib/supabase/dal";
import { Logo } from "@/app/components/logo";

export default async function Home() {
  const user = await getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/login"
            className="rounded-md px-3 py-1.5 font-medium text-ink-muted hover:text-ink"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-brand px-3 py-1.5 font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Create account
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <p className="text-sm font-medium text-brand">
          Contractor onboarding &amp; compliance
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Stop chasing contractors for paperwork
        </h1>
        <p className="mt-5 max-w-xl text-lg text-ink-muted">
          Collect insurance certificates, licences, and workers comp from your
          subcontractors, review them in one place, and know at a glance who is
          approved to work.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Get started
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-md border border-line-strong px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
          >
            Log in
          </Link>
        </div>
      </main>
    </div>
  );
}
