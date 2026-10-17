"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/app/components/spinner";

export function SignOutButton({
  variant = "menu",
}: {
  /** "sidebar" is the dark navigation rail; the others sit on light surfaces. */
  variant?: "menu" | "inline" | "sidebar";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await createClient().auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  };

  if (variant === "sidebar") {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        disabled={pending}
        className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-ink-muted transition-colors hover:bg-sidebar-bg-elevated hover:text-sidebar-ink disabled:opacity-60"
      >
        {pending ? (
          <Spinner className="h-4 w-4" />
        ) : (
          <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden />
        )}
        {pending ? "Signing out…" : "Sign out"}
      </button>
    );
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        disabled={pending}
        className="pressable inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 text-xs font-semibold text-ink-muted hover:border-field-line hover:text-ink disabled:opacity-60"
      >
        {pending && <Spinner className="h-4 w-4" />}
        {pending ? "Signing out…" : "Sign out"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-60"
    >
      {pending ? (
        <Spinner className="h-4 w-4" />
      ) : (
        <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden />
      )}
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
