import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyOwnerEmail } from "@/lib/onboarding";
import { getAppUrl } from "@/lib/app-url";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { sendTrialEndingEmail } from "@/lib/email/billing";

export const runtime = "nodejs";

interface TrialRow {
  company_id: string;
  plan: PlanId | null;
  trial_end: string;
}

const DAY = 86_400_000;

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

  const daysLeft = (iso: string) =>
    Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY));

  async function remind(
    row: TrialRow,
    column: "trial_reminder_5_at" | "trial_reminder_7_at",
  ) {
    const email = await getCompanyOwnerEmail(row.company_id);
    const plan = row.plan ? PLANS[row.plan] : null;
    if (email && plan) {
      await sendTrialEndingEmail({
        to: email,
        daysLeft: daysLeft(row.trial_end),
        planName: plan.name,
        amount: plan.amount,
        billingUrl,
      });
    }
    await admin
      .from("subscriptions")
      .update({ [column]: nowIso })
      .eq("company_id", row.company_id);
  }

  let reminder5Sent = 0;
  let reminder7Sent = 0;

  // Day ~5: about 2 days of trial left, first heads-up not yet sent.
  const { data: nearing } = await admin
    .from("subscriptions")
    .select("company_id, plan, trial_end")
    .eq("status", "trialing")
    .is("trial_reminder_5_at", null)
    .not("trial_end", "is", null)
    .gt("trial_end", nowIso)
    .lte("trial_end", new Date(now + 2.5 * DAY).toISOString());

  for (const row of (nearing ?? []) as TrialRow[]) {
    await remind(row, "trial_reminder_5_at");
    reminder5Sent += 1;
  }

  // Day ~7: trial ends within a day, final reminder not yet sent.
  const { data: ending } = await admin
    .from("subscriptions")
    .select("company_id, plan, trial_end")
    .eq("status", "trialing")
    .is("trial_reminder_7_at", null)
    .not("trial_end", "is", null)
    .lte("trial_end", new Date(now + 1 * DAY).toISOString());

  for (const row of (ending ?? []) as TrialRow[]) {
    await remind(row, "trial_reminder_7_at");
    reminder7Sent += 1;
  }

  return Response.json({ ok: true, reminder5Sent, reminder7Sent });
}
