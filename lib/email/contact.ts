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

export interface ContactEmailInput {
  name: string;
  email: string;
  message: string;
}

export async function sendContactEmail(
  input: ContactEmailInput,
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { ok: false, reason: "not_configured" };

  const to = process.env.CONTACT_EMAIL;
  if (!to) return { ok: false, reason: "not_configured" };

  const text = `From: ${input.name} <${input.email}>\n\n${input.message}`;
  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b17;">
  <p style="margin:0 0 8px;"><strong>From:</strong> ${escapeHtml(input.name)} &lt;${escapeHtml(input.email)}&gt;</p>
  <p style="margin:16px 0 0;white-space:pre-wrap;">${escapeHtml(input.message)}</p>
</body></html>`;

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    replyTo: input.email,
    subject: `Subbies contact — ${input.name}`,
    text,
    html,
  });

  if (error) {
    console.error("sendContactEmail failed", error);
    return { ok: false, reason: "send_failed", error: error.message };
  }
  return { ok: true, id: data?.id ?? null };
}
