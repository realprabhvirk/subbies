import "server-only";

import { getResend, FROM_ADDRESS } from "./resend";
import type { SendResult } from "./onboarding";
import { emailShell, emailButton, paragraph, escapeHtml, emailHeading, docList } from "./template";

export interface DocumentSubmittedEmailInput {
  to: string;
  contractorName: string;
  /** Names of the documents submitted in this batch. */
  documentNames: string[];
  reviewUrl: string;
}

/** Tells the company a contractor has uploaded something to review. */
export async function sendDocumentSubmittedEmail(
  input: DocumentSubmittedEmailInput,
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { ok: false, reason: "not_configured" };

  const list = input.documentNames.map((n) => `  - ${n}`).join("\n");
  const text = [
    `${input.contractorName} has submitted documents for review:`,
    "",
    list,
    "",
    "Review them here:",
    input.reviewUrl,
  ].join("\n");


  const html = emailShell({
    preheader: `${input.contractorName} submitted ${input.documentNames.length === 1 ? "a document" : "documents"} for review.`,
    bodyHtml: [
      emailHeading("New documents to review", "Awaiting your review"),
      paragraph(
        `<strong>${escapeHtml(input.contractorName)}</strong> has submitted documents for review:`,
      ),
      docList(input.documentNames.map((name) => ({ name }))),
      emailButton(input.reviewUrl, "Review documents"),
    ].join("\n"),
  });

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    subject: `${input.contractorName} submitted documents for review`,
    text,
    html,
  });

  if (error) {
    console.error("sendDocumentSubmittedEmail failed", error);
    return { ok: false, reason: "send_failed", error: error.message };
  }
  return { ok: true, id: data?.id ?? null };
}
