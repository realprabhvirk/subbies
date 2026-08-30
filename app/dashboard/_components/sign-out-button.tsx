"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton({
  variant = "menu",
}: {
  variant?: "menu" | "inline";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        className="rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-60"
      >
        {loading ? "Signing out…" : "Sign out"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden />
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
