import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyOwnerEmail } from "@/lib/onboarding";
import { getAppUrl } from "@/lib/app-url";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { markTrialReminderSent } from "@/lib/billing/trial-reminders";
import {
  sendTrialEndingEmail,
  sendTrialEndsTodayEmail,
} from "@/lib/email/billing";

export const runtime = "nodejs";

/**
 * Daily trial-reminder cron.
 *
 * Reminders are tied to whichever plan's trial the company is actually in —
 * there is no separate free-tier state. Two emails per trial:
 *
 *   day 5  ("2 days left")     — trial_end within DAY5_WINDOW_HOURS
 *   day 7  ("ends today")      — trial_end within DAY7_WINDOW_HOURS
 *
 * The windows are in hours, not days, because a trial starts at whatever time
 * of day checkout completed while this cron runs at a fixed hour. 60h catches
 * the day-5 run and 26h catches the final day without the two overlapping on
 * the same run.
 *
 * Both emails are also idempotent per company via markTrialReminderSent, which
 * the trial_will_end webhook shares — so a company never gets the day-5 email
 * twice regardless of which path fires first.
 */
const DAY5_WINDOW_HOURS = 60;
const DAY7_WINDOW_HOURS = 26;

interface TrialRow {
  company_id: string;
  plan: PlanId | null;
  trial_end: string;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const appUrl = await getAppUrl();
  const billingUrl = `${appUrl}/dashboard/settings?tab=billing`;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const horizon = (hours: number) =>
    new Date(now + hours * 3_600_000).toISOString();

  async function trialsEndingWithin(
    hours: number,
    sentColumn: string,
  ): Promise<TrialRow[]> {
    const { data, error } = await admin
      .from("subscriptions")
      .select("company_id, plan, trial_end")
      .eq("status", "trialing")
      .is(sentColumn, null)
      .not("trial_end", "is", null)
      .lte("trial_end", horizon(hours))
      .gt("trial_end", nowIso);

    if (error) {
      console.error("trial-reminders: query failed", { sentColumn, error });
      return [];
    }
    return (data ?? []) as TrialRow[];
  }

  let endingSent = 0;
  let endsTodaySent = 0;

  // Day 7 first: a trial inside the 26h window is also inside the 60h window,
  // and the company should get "ends today" rather than "2 days left".
  for (const row of await trialsEndingWithin(
    DAY7_WINDOW_HOURS,
    "trial_reminder_day7_at",
  )) {
    if (!(await markTrialReminderSent(row.company_id, "day7"))) continue;
    // The day-5 email is moot once the day-7 one goes out.
    await markTrialReminderSent(row.company_id, "day5");

    const email = await getCompanyOwnerEmail(row.company_id);
    if (email && row.plan) {
      await sendTrialEndsTodayEmail({
        to: email,
        planName: PLANS[row.plan].name,
        amount: PLANS[row.plan].amount,
        billingUrl,
      });
    }
    endsTodaySent += 1;
  }

  for (const row of await trialsEndingWithin(
    DAY5_WINDOW_HOURS,
    "trial_reminder_day5_at",
  )) {
    if (!(await markTrialReminderSent(row.company_id, "day5"))) continue;

    const email = await getCompanyOwnerEmail(row.company_id);
    if (email && row.plan) {
      const daysLeft = Math.max(
        1,
        Math.ceil((new Date(row.trial_end).getTime() - now) / 86_400_000),
      );
      await sendTrialEndingEmail({
        to: email,
        planName: PLANS[row.plan].name,
        amount: PLANS[row.plan].amount,
        daysLeft,
        trialEnd: row.trial_end,
        billingUrl,
      });
    }
    endingSent += 1;
  }

  return Response.json({ ok: true, endingSent, endsTodaySent });
}
