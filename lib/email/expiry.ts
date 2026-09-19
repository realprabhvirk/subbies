import "server-only";

import { getResend, FROM_ADDRESS } from "./resend";
import type { SendResult } from "./onboarding";
import { emailShell, emailButton, calloutBox, paragraph, escapeHtml } from "./template";

/**
 * The two expiry emails: the contractor nudge before a document lapses, and
 * the escalation to the company once one has.
 *
 * Same shape as lib/email/billing.ts — a private send() wrapping the shared
 * getResend()/FROM_ADDRESS pair, and bodies built from the emailShell
 * primitives — so there is still exactly one way this app sends email.
 */

async function send(
  to: string,
  subject: string,
  text: string,
  html: string,
  replyTo?: string | null,
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { ok: false, reason: "not_configured" };
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    replyTo: replyTo ?? undefined,
    subject,
    text,
    html,
  });
  if (error) {
    console.error("expiry email failed", subject, error);
    return { ok: false, reason: "send_failed", error: error.message };
  }
  return { ok: true, id: data?.id ?? null };
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** "in 30 days" / "tomorrow" / "today" — reads naturally in a sentence. */
function whenPhrase(daysLeft: number): string {
  if (daysLeft <= 0) return "today";
  if (daysLeft === 1) return "tomorrow";
  return `in ${daysLeft} days`;
}

export interface ExpiringDocumentLine {
  documentName: string;
  expiryDate: string;
  daysLeft: number;
}

export interface ExpiryReminderEmailInput {
  to: string;
  contactName: string | null;
  companyName: string;
  /** The company's own address, so a reply reaches a real person. */
  replyTo?: string | null;
  documents: ExpiringDocumentLine[];
  onboardUrl: string;
}

/**
 * Sent to the CONTRACTOR before one or more documents expire. Always one
 * email covering every document due for that contractor in this run —
 * nobody gets five separate emails in one morning.
 */
export async function sendExpiryReminderEmail(
  input: ExpiryReminderEmailInput,
): Promise<SendResult> {
  const greeting = input.contactName ? `Hi ${input.contactName},` : "Hi,";
  const soonest = Math.min(...input.documents.map((d) => d.daysLeft));
  const multiple = input.documents.length > 1;

  const subject = multiple
    ? `${input.companyName}: ${input.documents.length} of your documents are expiring soon`
    : `${input.companyName}: your ${input.documents[0].documentName} expires ${whenPhrase(soonest)}`;

  const lines = input.documents.map(
    (d) => `  - ${d.documentName} — expires ${formatDate(d.expiryDate)} (${whenPhrase(d.daysLeft)})`,
  );

  const text = [
    greeting,
    "",
    `${input.companyName} needs ${multiple ? "these documents" : "this document"} kept current:`,
    "",
    ...lines,
    "",
    "Upload a replacement here (same link as always, no login needed):",
    input.onboardUrl,
    "",
    `If you have questions, reply to this email and it will reach ${input.companyName}.`,
  ].join("\n");

  const items = input.documents
    .map(
      (d) =>
        `<li style="margin:4px 0;"><strong>${escapeHtml(d.documentName)}</strong> — expires ${escapeHtml(
          formatDate(d.expiryDate),
        )} (${escapeHtml(whenPhrase(d.daysLeft))})</li>`,
    )
    .join("");

  const html = emailShell({
    preheader: multiple
      ? `${input.documents.length} of your documents for ${input.companyName} are expiring soon.`
      : `Your ${input.documents[0].documentName} expires ${whenPhrase(soonest)}.`,
    bodyHtml: [
      paragraph(greeting),
      paragraph(
        `<strong>${escapeHtml(input.companyName)}</strong> needs ${
          multiple ? "these documents" : "this document"
        } kept current:`,
      ),
      calloutBox(
        soonest <= 7 ? "expired" : "attention",
        `<ul style="margin:0;padding-left:18px;">${items}</ul>`,
      ),
      emailButton(input.onboardUrl, multiple ? "Upload replacements" : "Upload a replacement"),
      paragraph(
        `This is the same link you've always used — no login needed. Reply to this email to reach ${escapeHtml(
          input.companyName,
        )}.`,
        { muted: true, last: true },
      ),
    ].join("\n"),
    footerHtml: `Sent via Subbies on behalf of ${escapeHtml(input.companyName)}.`,
  });

  return send(input.to, subject, text, html, input.replyTo);
}

export interface ExpiredEscalationLine {
  contractorName: string;
  documentName: string;
  expiryDate: string;
  daysOverdue: number;
}

export interface ExpiryEscalationEmailInput {
  to: string;
  documents: ExpiredEscalationLine[];
  dashboardUrl: string;
}

/**
 * Sent to the COMPANY once a document has actually lapsed — the "escalates to
 * you if they ignore it" half of what the product promises. One email per
 * run covering everything that lapsed, not one per document.
 */
export async function sendExpiryEscalationEmail(
  input: ExpiryEscalationEmailInput,
): Promise<SendResult> {
  const multiple = input.documents.length > 1;
  const subject = multiple
    ? `${input.documents.length} contractor documents have expired`
    : `${input.documents[0].contractorName}: ${input.documents[0].documentName} has expired`;

  const lines = input.documents.map(
    (d) =>
      `  - ${d.contractorName} — ${d.documentName}, expired ${formatDate(d.expiryDate)}`,
  );

  const text = [
    multiple
      ? "These contractor documents have expired and haven't been replaced:"
      : "This contractor document has expired and hasn't been replaced:",
    "",
    ...lines,
    "",
    "The contractor has been reminded. Review them here:",
    input.dashboardUrl,
  ].join("\n");

  const items = input.documents
    .map(
      (d) =>
        `<li style="margin:4px 0;"><strong>${escapeHtml(d.contractorName)}</strong> — ${escapeHtml(
          d.documentName,
        )}, expired ${escapeHtml(formatDate(d.expiryDate))}</li>`,
    )
    .join("");

  const html = emailShell({
    preheader: multiple
      ? `${input.documents.length} contractor documents have expired.`
      : `${input.documents[0].contractorName}'s ${input.documents[0].documentName} has expired.`,
    bodyHtml: [
      paragraph(
        multiple
          ? "These contractor documents have expired and haven&rsquo;t been replaced:"
          : "This contractor document has expired and hasn&rsquo;t been replaced:",
      ),
      calloutBox("expired", `<ul style="margin:0;padding-left:18px;">${items}</ul>`),
      emailButton(input.dashboardUrl, "Review in Subbies"),
      paragraph(
        "The contractor was reminded before this lapsed. You may want to follow up directly, or hold them off site until it&rsquo;s current.",
        { muted: true, last: true },
      ),
    ].join("\n"),
  });

  return send(input.to, subject, text, html);
}
