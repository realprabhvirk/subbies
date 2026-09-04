import "server-only";

import { getResend, FROM_ADDRESS } from "./resend";
import type { SendResult } from "./onboarding";
import { emailShell, paragraph, escapeHtml } from "./template";

export interface ContactEmailInput {
  name: string;
  email: string;
  message: string;
}

/** Internal notification to the founder — not customer-facing, but shares the same shell for visual consistency. */
export async function sendContactEmail(
  input: ContactEmailInput,
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { ok: false, reason: "not_configured" };

  const to = process.env.CONTACT_EMAIL;
  if (!to) return { ok: false, reason: "not_configured" };

  const text = `From: ${input.name} <${input.email}>\n\n${input.message}`;
  const html = emailShell({
    preheader: `New contact form message from ${input.name}.`,
    bodyHtml: [
      paragraph(
        `<strong>From:</strong> ${escapeHtml(input.name)} &lt;${escapeHtml(input.email)}&gt;`,
      ),
      `<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#120e0e;white-space:pre-wrap;">${escapeHtml(input.message)}</p>`,
    ].join("\n"),
  });

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
