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
    <div className="flex flex-col items-start gap-1 md:items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="pressable inline-flex h-11 items-center whitespace-nowrap gap-2 rounded-md border border-line-strong bg-surface px-4 text-xs font-semibold text-ink-muted hover:border-field-line hover:text-ink disabled:opacity-60"
      >
        {pending ? (
          <Spinner className="h-4 w-4" />
        ) : (
          <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
        )}
        {pending ? "Sending…" : "Resend request"}
      </button>
      {message && (
        <p
          role="status"
          className={`max-w-48 text-xs font-medium md:text-right ${message.ok ? "text-approved" : "text-expired"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
