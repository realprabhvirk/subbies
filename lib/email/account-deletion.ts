import "server-only";

import { getResend, FROM_ADDRESS } from "./resend";
import type { SendResult } from "./onboarding";
import { emailShell, calloutBox, paragraph } from "./template";

export interface AccountDeletionCodeEmailInput {
  to: string;
  code: string;
  expiresInMinutes: number;
}

/** The one code-delivery email in the account-deletion flow — see deletion-actions.ts. */
export async function sendAccountDeletionCodeEmail(
  input: AccountDeletionCodeEmailInput,
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { ok: false, reason: "not_configured" };

  const text = [
    "Confirm account deletion",
    "",
    "Enter this code to permanently delete your Subbies account and all its data:",
    "",
    input.code,
    "",
    `This code expires in ${input.expiresInMinutes} minutes.`,
    "",
    "If you didn't request this, you can ignore this email — your account is safe and nothing happens without the code.",
  ].join("\n");

  const html = emailShell({
    preheader: `Your account deletion code: ${input.code}`,
    bodyHtml: [
      paragraph(
        "Enter this code to permanently delete your Subbies account and all its data. This cannot be undone.",
      ),
      calloutBox(
        "expired",
        `<span style="font-size:28px;font-weight:700;letter-spacing:6px;">${input.code}</span>`,
      ),
      paragraph(`This code expires in ${input.expiresInMinutes} minutes.`, { muted: true }),
      paragraph(
        "If you didn't request this, you can ignore this email — your account is safe and nothing happens without the code.",
        { muted: true, last: true },
      ),
    ].join("\n"),
  });

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    subject: "Confirm account deletion",
    text,
    html,
  });

  if (error) {
    console.error("sendAccountDeletionCodeEmail failed", error);
    return { ok: false, reason: "send_failed", error: error.message };
  }
  return { ok: true, id: data?.id ?? null };
}
