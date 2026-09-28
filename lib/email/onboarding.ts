import "server-only";

import { getResend, FROM_ADDRESS } from "./resend";
import { emailShell, emailButton, calloutBox, paragraph, escapeHtml } from "./template";
import { REFRESH_NOTE, requestSubject, requestText } from "./request-copy";

export interface OnboardingEmailInput {
  to: string;
  contactName: string | null;
  companyName: string;
  /** The company's own email, so the contractor can reply to a real person. */
  replyTo?: string | null;
  /** Documents that are genuinely outstanding: not yet supplied, rejected, or expired. */
  documentNames: string[];
  /**
   * Documents where a valid copy is already on file and the company is simply
   * asking for a fresh one. Worded as an "updated copy" request, and says the
   * existing copy stays valid until the new one is approved. Never described
   * as missing or expired, because it isn't.
   */
  refreshDocumentNames?: string[];
  onboardUrl: string;
}

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: "not_configured" | "send_failed"; error?: string };

function buildHtml(input: OnboardingEmailInput): string {
  const greeting = input.contactName
    ? `Hi ${escapeHtml(input.contactName)},`
    : "Hi,";
  const list = (names: string[]) =>
    `<ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.6;">${names
      .map((name) => `<li style="margin:4px 0;">${escapeHtml(name)}</li>`)
      .join("")}</ul>`;

  const needed = input.documentNames;
  const refresh = input.refreshDocumentNames ?? [];
  const company = `<strong>${escapeHtml(input.companyName)}</strong>`;

  const sections: string[] = [];
  if (needed.length > 0) {
    sections.push(
      paragraph(
        `${company} uses Subbies to collect and review contractor compliance documents before work begins. They've asked you to provide the following:`,
      ),
      list(needed),
    );
  }
  if (refresh.length > 0) {
    sections.push(
      paragraph(
        needed.length > 0
          ? `They've also asked for an updated copy of the following. ${REFRESH_NOTE}`
          : `${company} uses Subbies to collect and review contractor compliance documents. They've asked for an updated copy of the following. ${REFRESH_NOTE}`,
      ),
      list(refresh),
    );
  }

  const body = [
    paragraph(greeting),
    ...sections,
    emailButton(input.onboardUrl, "Upload your documents"),
    paragraph(
      `The link is unique to you and doesn't need a password. If you have any questions, reply to this email and it will reach ${escapeHtml(input.companyName)}.`,
      { muted: true, last: true },
    ),
  ].join("\n");

  const total = needed.length + refresh.length;
  return emailShell({
    preheader:
      needed.length === 0
        ? `${input.companyName} has asked for an updated copy of ${total === 1 ? "a document" : "some documents"}.`
        : `${input.companyName} needs ${total === 1 ? "a document" : "some documents"} from you before work starts.`,
    bodyHtml: body,
    footerHtml: `Sent via Subbies on behalf of ${escapeHtml(input.companyName)}.`,
  });
}

export async function sendOnboardingEmail(
  input: OnboardingEmailInput,
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { ok: false, reason: "not_configured" };

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    replyTo: input.replyTo ?? undefined,
    subject: requestSubject(input),
    text: requestText(input),
    html: buildHtml(input),
  });

  if (error) {
    console.error("sendOnboardingEmail failed", error);
    return { ok: false, reason: "send_failed", error: error.message };
  }

  return { ok: true, id: data?.id ?? null };
}

export interface ContractorApprovedEmailInput {
  to: string;
  contactName: string | null;
  companyName: string;
  replyTo?: string | null;
  businessName: string;
}

export async function sendContractorApprovedEmail(
  input: ContractorApprovedEmailInput,
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { ok: false, reason: "not_configured" };

  const greeting = input.contactName ? `Hi ${input.contactName},` : "Hi,";
  const text = [
    greeting,
    "",
    `${input.companyName} has approved all of the compliance documents for ${input.businessName}. You're cleared to work.`,
    "",
    `We'll be in touch before anything is due to expire. If you have questions, reply to this email and it will reach ${input.companyName}.`,
  ].join("\n");

  const htmlGreeting = input.contactName
    ? `Hi ${escapeHtml(input.contactName)},`
    : "Hi,";

  const html = emailShell({
    preheader: `${input.companyName} has approved all your documents. You're cleared to work.`,
    bodyHtml: [
      paragraph(htmlGreeting),
      calloutBox(
        "approved",
        `${escapeHtml(input.companyName)} has approved all of the compliance documents for <strong>${escapeHtml(input.businessName)}</strong>. You&rsquo;re cleared to work.`,
      ),
      paragraph(
        `We&rsquo;ll be in touch before anything is due to expire. Reply to this email to reach ${escapeHtml(input.companyName)}.`,
        { muted: true, last: true },
      ),
    ].join("\n"),
  });

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    replyTo: input.replyTo ?? undefined,
    subject: `${input.companyName}: you're approved to work`,
    text,
    html,
  });

  if (error) {
    console.error("sendContractorApprovedEmail failed", error);
    return { ok: false, reason: "send_failed", error: error.message };
  }
  return { ok: true, id: data?.id ?? null };
}

export interface DocumentRejectedEmailInput {
  to: string;
  contactName: string | null;
  companyName: string;
  replyTo?: string | null;
  documentName: string;
  reason: string;
  onboardUrl: string;
}

export async function sendDocumentRejectedEmail(
  input: DocumentRejectedEmailInput,
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { ok: false, reason: "not_configured" };

  const greeting = input.contactName ? `Hi ${input.contactName},` : "Hi,";
  const text = [
    greeting,
    "",
    `${input.companyName} has reviewed the ${input.documentName} you submitted and it needs to be re-uploaded.`,
    "",
    `Reason: ${input.reason}`,
    "",
    "Upload a replacement here (same link as before, no login needed):",
    input.onboardUrl,
    "",
    `If you have questions, reply to this email and it will reach ${input.companyName}.`,
  ].join("\n");

  const htmlGreeting = input.contactName
    ? `Hi ${escapeHtml(input.contactName)},`
    : "Hi,";

  const html = emailShell({
    preheader: `${input.documentName} needs to be re-uploaded. Here's why.`,
    bodyHtml: [
      paragraph(htmlGreeting),
      paragraph(
        `${escapeHtml(input.companyName)} has reviewed the <strong>${escapeHtml(input.documentName)}</strong> you submitted and it needs to be re-uploaded.`,
      ),
      calloutBox("expired", `<strong>Reason:</strong> ${escapeHtml(input.reason)}`),
      emailButton(input.onboardUrl, "Upload a replacement"),
      paragraph(
        `This is the same link as before. Reply to this email to reach ${escapeHtml(input.companyName)}.`,
        { muted: true, last: true },
      ),
    ].join("\n"),
  });

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    replyTo: input.replyTo ?? undefined,
    subject: `${input.companyName}: ${input.documentName} needs re-uploading`,
    text,
    html,
  });

  if (error) {
    console.error("sendDocumentRejectedEmail failed", error);
    return { ok: false, reason: "send_failed", error: error.message };
  }
  return { ok: true, id: data?.id ?? null };
}
