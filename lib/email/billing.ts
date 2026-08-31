import "server-only";

import { getResend, FROM_ADDRESS } from "./resend";
import type { SendResult } from "./onboarding";

function shell(bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background-color:#f6f5f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f5f2;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e4e2db;border-radius:10px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b17;">
      <tr><td style="padding:24px 28px;border-bottom:1px solid #e4e2db;font-weight:600;font-size:16px;color:#0f2740;">Subbies</td></tr>
      <tr><td style="padding:28px;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 4px;"><tr><td style="border-radius:6px;background-color:#1c3d5a;">
    <a href="${href}" style="display:inline-block;padding:11px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${label}</a>
  </td></tr></table>`;
}

async function send(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { ok: false, reason: "not_configured" };
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    text,
    html,
  });
  if (error) {
    console.error("billing email failed", subject, error);
    return { ok: false, reason: "send_failed", error: error.message };
  }
  return { ok: true, id: data?.id ?? null };
}

export function sendSubscriptionStartedEmail(input: {
  to: string;
  planName: string;
  amount: number;
}): Promise<SendResult> {
  const text = `Your Subbies ${input.planName} plan is now active and your card has been charged A$${input.amount}. Your subscription continues month to month — manage or cancel any time from Settings → Billing.`;
  return send(
    input.to,
    "Your Subbies subscription is active",
    text,
    shell(
      `<p style="margin:0 0 16px;">Your <strong>${input.planName}</strong> plan is now active and your card has been charged <strong>A$${input.amount}</strong>.</p>
       <p style="margin:0;color:#64615a;font-size:13px;">Manage or cancel any time from Settings → Billing.</p>`,
    ),
  );
}

export function sendPaymentFailedEmail(input: {
  to: string;
  billingUrl: string;
}): Promise<SendResult> {
  const text = `We couldn't process your latest Subbies payment. Please update your card in Settings → Billing (${input.billingUrl}) to keep your plan. We'll retry automatically over the next few days.`;
  return send(
    input.to,
    "Action needed: your Subbies payment failed",
    text,
    shell(
      `<p style="margin:0 0 16px;">We couldn&apos;t process your latest Subbies payment.</p>
       <p style="margin:0 0 20px;">Please update your card to keep your plan — we&apos;ll retry automatically over the next few days.</p>
       ${button(input.billingUrl, "Update payment method")}`,
    ),
  );
}

export function sendTrialEndingEmail(input: {
  to: string;
  daysLeft: number;
  planName: string;
  amount: number;
  billingUrl: string;
}): Promise<SendResult> {
  const days =
    input.daysLeft <= 0
      ? "today"
      : `in ${input.daysLeft} ${input.daysLeft === 1 ? "day" : "days"}`;
  const text = `Your Subbies ${input.planName} trial ends ${days}. When it does, the card on file is charged A$${input.amount}/month and your plan continues month to month. Cancel any time before then from Settings → Billing (${input.billingUrl}).`;
  return send(
    input.to,
    `Your Subbies trial ends ${days}`,
    text,
    shell(
      `<p style="margin:0 0 16px;">Your <strong>${input.planName}</strong> trial ends <strong>${days}</strong>.</p>
       <p style="margin:0 0 20px;">When it does, the card on file is charged <strong>A$${input.amount}/month</strong> and your plan continues month to month. Cancel any time before then.</p>
       ${button(input.billingUrl, "Manage billing")}`,
    ),
  );
}
