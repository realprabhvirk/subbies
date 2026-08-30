"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { Spinner } from "@/app/components/spinner";
import { resendOnboardingRequest } from "../actions";

export function ResendButton({ contractorId }: { contractorId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  const handleClick = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await resendOnboardingRequest(contractorId);
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-muted disabled:opacity-60"
      >
        {pending ? (
          <Spinner className="h-3.5 w-3.5" />
        ) : (
          <Send className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        )}
        {pending ? "Sending…" : "Resend request"}
      </button>
      {message && (
        <p
          className={`text-xs ${message.ok ? "text-approved" : "text-expired"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
