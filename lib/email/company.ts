import "server-only";

import { getResend, FROM_ADDRESS } from "./resend";
import type { SendResult } from "./onboarding";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

  const items = input.documentNames
    .map((n) => `<li style="margin:4px 0;">${escapeHtml(n)}</li>`)
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f6f5f2;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f5f2;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e4e2db;border-radius:10px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b17;">
          <tr><td style="padding:24px 28px;border-bottom:1px solid #e4e2db;font-weight:600;font-size:16px;color:#0f2740;">Subbies</td></tr>
          <tr><td style="padding:28px;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
              <strong>${escapeHtml(input.contractorName)}</strong> has submitted
              documents for review:
            </p>
            <ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.6;">${items}</ul>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr><td style="border-radius:6px;background-color:#1c3d5a;">
                <a href="${input.reviewUrl}" style="display:inline-block;padding:11px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Review documents</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

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
