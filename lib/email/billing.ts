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

function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
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

export function sendTrialEndingEmail(input: {
  to: string;
  planName: string;
  amount: number;
  trialEnd: string | null;
}): Promise<SendResult> {
  const when = input.trialEnd ? ` on ${fmtDate(input.trialEnd)}` : " soon";
  const text = `Your Subbies free trial ends${when}. Unless you cancel first, the card on file will be charged A$${input.amount} for the ${input.planName} plan and your subscription will continue month to month. You can cancel any time from Settings → Billing.`;
  return send(
    input.to,
    `Your Subbies trial ends${when}`,
    text,
    shell(
      `<p style="margin:0 0 16px;">Your Subbies free trial ends<strong>${when}</strong>.</p>
       <p style="margin:0 0 16px;">Unless you cancel first, the card on file will be charged <strong>A$${input.amount}</strong> for the ${input.planName} plan and your subscription continues month to month.</p>
       <p style="margin:0;color:#64615a;font-size:13px;">Cancel any time from Settings → Billing.</p>`,
    ),
  );
}

export function sendTrialConvertedEmail(input: {
  to: string;
  planName: string;
  amount: number;
}): Promise<SendResult> {
  const text = `Your Subbies free trial has ended and your ${input.planName} subscription is now active. The card on file was charged A$${input.amount}. Manage or cancel any time from Settings → Billing.`;
  return send(
    input.to,
    "Your Subbies subscription is active",
    text,
    shell(
      `<p style="margin:0 0 16px;">Your free trial has ended and your <strong>${input.planName}</strong> subscription is now active.</p>
       <p style="margin:0 0 16px;">The card on file was charged <strong>A$${input.amount}</strong>.</p>
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
       <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:6px;background-color:#1c3d5a;">
         <a href="${input.billingUrl}" style="display:inline-block;padding:11px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Update payment method</a>
       </td></tr></table>`,
    ),
  );
}
