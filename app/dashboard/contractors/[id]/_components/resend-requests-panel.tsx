"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Minus, Send } from "lucide-react";

import { Alert } from "@/app/components/alert";
import { SectionCard } from "@/app/components/section-card";
import { Button } from "@/app/components/button";
import { resendDocumentRequests } from "../manage-actions";

export interface ResendableDocument {
  id: string;
  name: string;
  /** Where this document stands, worded on the server (so dates can't differ from the browser's). */
  note: string;
}

/**
 * Pick any documents and send the contractor ONE email covering them. There is
 * no status filtering: the company may want a fresh copy of something already
 * approved as much as a chase for something missing. Ticking an approved
 * document doesn't touch it — it asks for an updated copy, and the current one
 * stays valid until the new one is uploaded and approved.
 */
export function ResendRequestsPanel({
  contractorId,
  contractorEmail,
  documents,
}: {
  contractorId: string;
  contractorEmail: string;
  documents: ResendableDocument[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const allRef = useRef<HTMLInputElement>(null);

  // Only ever act on rows that still exist: if a document was approved or
  // revoked elsewhere since this list rendered, a stale tick shouldn't be sent.
  const live = documents.filter((d) => selected.has(d.id));
  const allOn = documents.length > 0 && live.length === documents.length;
  const someOn = live.length > 0 && !allOn;

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = someOn;
  }, [someOn]);

  const toggle = (id: string) => {
    setMessage(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setMessage(null);
    setSelected(allOn ? new Set() : new Set(documents.map((d) => d.id)));
  };

  const send = () => {
    if (live.length === 0 || pending) return;
    setMessage(null);
    startTransition(async () => {
      const result = await resendDocumentRequests(
        contractorId,
        live.map((d) => d.id),
      );
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setSelected(new Set());
      setMessage({
        ok: true,
        text: `One email sent to ${result.sentTo} for ${result.count} ${
          result.count === 1 ? "document" : "documents"
        }.`,
      });
    });
  };

  return (
    <SectionCard
      id="resend-requests"
      icon={Send}
      tone="brand"
      title="Resend requests"
      subtitle={`Email ${contractorEmail} a link for the documents you tick. An approved document stays valid: ticking it asks for an updated copy, and the current one is only replaced once the new one is approved.`}
    >
      {documents.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-strong px-4 py-3 text-sm text-ink-muted">
          No documents have been requested from this contractor yet.
        </p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <label
              className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-line-strong bg-surface-muted px-4 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-brand sm:px-5"
            >
              <input
                ref={allRef}
                type="checkbox"
                checked={allOn}
                onChange={toggleAll}
                disabled={pending}
                className="sr-only"
              />
              <Box state={allOn ? "on" : someOn ? "some" : "off"} />
              <span className="font-semibold">Select all</span>
              <span className="ml-auto font-mono text-xs text-ink-muted">
                {live.length}/{documents.length} selected
              </span>
            </label>

            <fieldset className="divide-y divide-line">
              <legend className="sr-only">Documents to resend</legend>
              {documents.map((doc) => {
                const on = selected.has(doc.id);
                return (
                  <label
                    key={doc.id}
                    className={`flex min-h-14 cursor-pointer items-start gap-3 px-4 py-4 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-brand sm:px-5 ${
                      on ? "bg-brand-tint/60" : "hover:bg-surface-muted/70"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(doc.id)}
                      disabled={pending}
                      className="sr-only"
                    />
                    <Box state={on ? "on" : "off"} />
                    <span className="min-w-0">
                      <span className="font-semibold">{doc.name}</span>
                      <span className="mt-0.5 block text-xs text-ink-muted">{doc.note}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </div>

          {message && (
            <Alert tone={message.ok ? "success" : "error"} className="mt-4">
              {message.text}
            </Alert>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            {live.length === 0 && !message && (
              <span className="text-sm text-ink-muted">Select at least one document</span>
            )}
            <Button
              type="button"
              onClick={send}
              disabled={live.length === 0}
              pending={pending}
            >
              {!pending && <Send className="h-4 w-4" strokeWidth={2} aria-hidden />}
              {pending ? "Sending…" : "Resend requests"}
            </Button>
          </div>
        </>
      )}
    </SectionCard>
  );
}

/** The visual checkbox — the real input is screen-reader-only beside it. */
function Box({ state }: { state: "on" | "off" | "some" }) {
  return (
    <span
      className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
        state === "off"
          ? "border-field-line bg-surface"
          : "border-brand bg-brand text-white"
      }`}
      aria-hidden
    >
      {state === "on" && <Check className="h-4 w-4" strokeWidth={3} />}
      {state === "some" && <Minus className="h-4 w-4" strokeWidth={3} />}
    </span>
  );
}
