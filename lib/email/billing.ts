import "server-only";

import { getResend, FROM_ADDRESS } from "./resend";
import type { SendResult } from "./onboarding";
import { emailShell, emailButton, calloutBox, paragraph } from "./template";

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
  const html = emailShell({
    preheader: `Your ${input.trialDays}-day free trial has started — nothing charged yet.`,
    bodyHtml: [
      paragraph(
        `Your <strong>${input.planName}</strong> plan is set up and your <strong>${input.trialDays}-day free trial</strong> has started. Nothing has been charged.`,
      ),
      calloutBox(
        "attention",
        `On <strong>${endsOn}</strong> your card will be charged <strong>A$${input.amount}</strong> and your plan continues month to month.`,
      ),
      paragraph("Cancel any time before then from Settings &rarr; Billing.", {
        muted: true,
        last: true,
      }),
    ].join("\n"),
  });
  return send(input.to, `Your Subbies ${input.planName} trial has started`, text, html);
}

/** Sent when a trial converts (or a plan starts charging immediately). */
export function sendSubscriptionStartedEmail(input: {
  to: string;
  planName: string;
  amount: number;
}): Promise<SendResult> {
  const text = `Your Subbies ${input.planName} plan is now active and your card has been charged A$${input.amount}. Your subscription continues month to month — manage or cancel any time from Settings → Billing.`;
  const html = emailShell({
    preheader: `Your ${input.planName} plan is active — thanks for subscribing.`,
    bodyHtml: [
      calloutBox(
        "approved",
        `Your <strong>${input.planName}</strong> plan is now active and your card has been charged <strong>A$${input.amount}</strong>.`,
      ),
      paragraph("Manage or cancel any time from Settings &rarr; Billing.", {
        muted: true,
        last: true,
      }),
    ].join("\n"),
  });
  return send(input.to, "Your Subbies subscription is active", text, html);
}

export function sendPaymentFailedEmail(input: {
  to: string;
  billingUrl: string;
}): Promise<SendResult> {
  const text = `We couldn't process your latest Subbies payment. Please update your card in Settings → Billing (${input.billingUrl}) to keep your plan. We'll retry automatically over the next few days.`;
  const html = emailShell({
    preheader: "Update your card to keep your Subbies plan active.",
    bodyHtml: [
      calloutBox("expired", "We couldn&rsquo;t process your latest Subbies payment."),
      paragraph(
        "Please update your card to keep your plan &mdash; we&rsquo;ll retry automatically over the next few days.",
      ),
      emailButton(input.billingUrl, "Update payment method"),
    ].join("\n"),
  });
  return send(input.to, "Action needed: your Subbies payment failed", text, html);
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
  const html = emailShell({
    preheader: `Your free trial ends in ${days} — here's what happens next.`,
    bodyHtml: [
      paragraph(
        `Your <strong>${input.planName}</strong> free trial ends in <strong>${days}</strong>.`,
      ),
      calloutBox(
        "attention",
        `On <strong>${endsOn}</strong> your card will be charged <strong>A$${input.amount}/month</strong> and everything keeps working &mdash; you don&rsquo;t need to do anything. If you&rsquo;d rather not continue, you can cancel before then.`,
      ),
      emailButton(input.billingUrl, "Manage billing"),
    ].join("\n"),
  });
  return send(input.to, `Your Subbies trial ends in ${days}`, text, html);
}

/** "Your trial ends today" — the day-7 reminder, sent on the final day. */
export function sendTrialEndsTodayEmail(input: {
  to: string;
  planName: string;
  amount: number;
  billingUrl: string;
}): Promise<SendResult> {
  const text = `Your Subbies ${input.planName} free trial ends today. Your card will be charged A$${input.amount} and your plan continues month to month — nothing changes and nothing is lost. To stop before the charge, cancel from Settings → Billing (${input.billingUrl}) today.`;
  const html = emailShell({
    preheader: "Your free trial ends today.",
    bodyHtml: [
      paragraph(`Your <strong>${input.planName}</strong> free trial ends today.`),
      calloutBox(
        "attention",
        `Your card will be charged <strong>A$${input.amount}</strong> and your plan continues month to month &mdash; nothing changes and nothing is lost. To stop before the charge, cancel today.`,
      ),
      emailButton(input.billingUrl, "Manage billing"),
    ].join("\n"),
  });
  return send(input.to, "Your Subbies free trial ends today", text, html);
}
