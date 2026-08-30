import "server-only";

import { getResend, FROM_ADDRESS } from "./resend";

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSubject(companyName: string): string {
  return `${companyName} — documents needed before you start work`;
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
    "Upload your documents here (no login needed — the link is unique to you):",
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
    .map(
      (name) =>
        `<li style="margin:4px 0;">${escapeHtml(name)}</li>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f6f5f2;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f5f2;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e4e2db;border-radius:10px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b17;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid #e4e2db;font-weight:600;font-size:16px;color:#0f2740;">
                ${escapeHtml(input.companyName)}
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${greeting}</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
                  ${escapeHtml(input.companyName)} uses Subbies to collect and review
                  contractor compliance documents before work begins. They've asked you
                  to provide the following:
                </p>
                <ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.6;">
                  ${items}
                </ul>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="border-radius:6px;background-color:#1c3d5a;">
                      <a href="${input.onboardUrl}" style="display:inline-block;padding:11px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                        Upload your documents
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#64615a;">
                  The link is unique to you and doesn't need a password. If you have any
                  questions, reply to this email and it will reach ${escapeHtml(
                    input.companyName,
                  )}.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid #e4e2db;font-size:12px;color:#8f8b81;">
                Sent via Subbies on behalf of ${escapeHtml(input.companyName)}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f6f5f2;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f5f2;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e4e2db;border-radius:10px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b17;">
          <tr><td style="padding:24px 28px;border-bottom:1px solid #e4e2db;font-weight:600;font-size:16px;color:#0f2740;">${escapeHtml(input.companyName)}</td></tr>
          <tr><td style="padding:28px;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${greeting}</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
              ${escapeHtml(input.companyName)} has reviewed the
              <strong>${escapeHtml(input.documentName)}</strong> you submitted and it
              needs to be re-uploaded.
            </p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;padding:12px 14px;background-color:#f4e5e3;border-radius:6px;color:#a5352f;">
              Reason: ${escapeHtml(input.reason)}
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
              <tr><td style="border-radius:6px;background-color:#1c3d5a;">
                <a href="${input.onboardUrl}" style="display:inline-block;padding:11px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Upload a replacement</a>
              </td></tr>
            </table>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#64615a;">
              This is the same link as before. Reply to this email to reach ${escapeHtml(input.companyName)}.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    replyTo: input.replyTo ?? undefined,
    subject: `${input.companyName} — ${input.documentName} needs re-uploading`,
    text,
    html,
  });

  if (error) {
    console.error("sendDocumentRejectedEmail failed", error);
    return { ok: false, reason: "send_failed", error: error.message };
  }
  return { ok: true, id: data?.id ?? null };
}
