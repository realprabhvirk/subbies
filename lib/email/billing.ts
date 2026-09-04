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

function formatDate(iso: string | null): string {
  if (!iso) return "the end of your trial";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(new Date(iso));
}

/** Sent once, when a plan's free trial begins (card on file, nothing charged). */
export function sendTrialStartedEmail(input: {
  to: string;
  planName: string;
  amount: number;
  trialDays: number;
  trialEnd: string | null;
}): Promise<SendResult> {
  const endsOn = formatDate(input.trialEnd);
  const text = `Your Subbies ${input.planName} plan is set up and your ${input.trialDays}-day free trial has started. Nothing has been charged. On ${endsOn} your card will be charged A$${input.amount} and your plan continues month to month. Cancel any time before then from Settings → Billing.`;
  return send(
    input.to,
    `Your Subbies ${input.planName} trial has started`,
    text,
    shell(
      `<p style="margin:0 0 16px;">Your <strong>${input.planName}</strong> plan is set up and your <strong>${input.trialDays}-day free trial</strong> has started. Nothing has been charged.</p>
       <p style="margin:0 0 16px;">On <strong>${endsOn}</strong> your card will be charged <strong>A$${input.amount}</strong> and your plan continues month to month.</p>
       <p style="margin:0;color:#64615a;font-size:13px;">Cancel any time before then from Settings &rarr; Billing.</p>`,
    ),
  );
}

/** Sent when a trial converts (or a plan starts charging immediately). */
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
       <p style="margin:0;color:#64615a;font-size:13px;">Manage or cancel any time from Settings &rarr; Billing.</p>`,
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

/**
 * "Your trial ends in N days" — the day-5 reminder of a 7-day trial. Tied to
 * whichever plan's trial the company is actually in.
 */
export function sendTrialEndingEmail(input: {
  to: string;
  planName: string;
  amount: number;
  daysLeft: number;
  trialEnd: string | null;
  billingUrl: string;
}): Promise<SendResult> {
  const days = `${input.daysLeft} ${input.daysLeft === 1 ? "day" : "days"}`;
  const endsOn = formatDate(input.trialEnd);
  const text = `Your Subbies ${input.planName} free trial ends in ${days}. On ${endsOn} your card will be charged A$${input.amount}/month and everything keeps working — no action needed. If you'd rather not continue, cancel from Settings → Billing (${input.billingUrl}) before then.`;
  return send(
    input.to,
    `Your Subbies trial ends in ${days}`,
    text,
    shell(
      `<p style="margin:0 0 16px;">Your <strong>${input.planName}</strong> free trial ends in <strong>${days}</strong>.</p>
       <p style="margin:0 0 20px;">On <strong>${endsOn}</strong> your card will be charged <strong>A$${input.amount}/month</strong> and everything keeps working — you don&apos;t need to do anything. If you&apos;d rather not continue, you can cancel before then.</p>
       ${button(input.billingUrl, "Manage billing")}`,
    ),
  );
}

/** "Your trial ends today" — the day-7 reminder, sent on the final day. */
export function sendTrialEndsTodayEmail(input: {
  to: string;
  planName: string;
  amount: number;
  billingUrl: string;
}): Promise<SendResult> {
  const text = `Your Subbies ${input.planName} free trial ends today. Your card will be charged A$${input.amount} and your plan continues month to month — nothing changes and nothing is lost. To stop before the charge, cancel from Settings → Billing (${input.billingUrl}) today.`;
  return send(
    input.to,
    "Your Subbies free trial ends today",
    text,
    shell(
      `<p style="margin:0 0 16px;">Your <strong>${input.planName}</strong> free trial ends today.</p>
       <p style="margin:0 0 20px;">Your card will be charged <strong>A$${input.amount}</strong> and your plan continues month to month — nothing changes and nothing is lost. To stop before the charge, cancel today.</p>
       ${button(input.billingUrl, "Manage billing")}`,
    ),
  );
}
