import "server-only";

import { getResend, FROM_ADDRESS } from "./resend";
import { emailShell, emailButton, calloutBox, paragraph, escapeHtml } from "./template";

export interface OnboardingEmailInput {
  to: string;
  contactName: string | null;
  companyName: string;
  /** The company's own email, so the contractor can reply to a real person. */
  replyTo?: string | null;
  documentNames: string[];
  onboardUrl: string;
}

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: "not_configured" | "send_failed"; error?: string };

function buildSubject(companyName: string): string {
  return `${companyName}: documents needed before you start work`;
}

function buildText(input: OnboardingEmailInput): string {
  const greeting = input.contactName ? `Hi ${input.contactName},` : "Hi,";
  const list = input.documentNames.map((name) => `  - ${name}`).join("\n");
  return [
    greeting,
    "",
    `${input.companyName} uses Subbies to collect and review contractor compliance documents before work begins. They've asked you to provide the following:`,
    "",
    list,
    "",
    "Upload your documents here (no login needed, the link is unique to you):",
    input.onboardUrl,
    "",
    `If you have any questions, reply to this email and it will reach ${input.companyName}.`,
    "",
    "Sent via Subbies on behalf of " + input.companyName,
  ].join("\n");
}

function buildHtml(input: OnboardingEmailInput): string {
  const greeting = input.contactName
    ? `Hi ${escapeHtml(input.contactName)},`
    : "Hi,";
  const items = input.documentNames
    .map((name) => `<li style="margin:4px 0;">${escapeHtml(name)}</li>`)
    .join("");

  const body = [
    paragraph(greeting),
    paragraph(
      `<strong>${escapeHtml(input.companyName)}</strong> uses Subbies to collect and review contractor compliance documents before work begins. They've asked you to provide the following:`,
    ),
    `<ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.6;">${items}</ul>`,
    emailButton(input.onboardUrl, "Upload your documents"),
    paragraph(
      `The link is unique to you and doesn't need a password. If you have any questions, reply to this email and it will reach ${escapeHtml(input.companyName)}.`,
      { muted: true, last: true },
    ),
  ].join("\n");

  return emailShell({
    preheader: `${input.companyName} needs ${input.documentNames.length === 1 ? "a document" : "some documents"} from you before work starts.`,
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
    subject: buildSubject(input.companyName),
    text: buildText(input),
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
