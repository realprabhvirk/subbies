import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type TrialReminder = "day5" | "day7";

const COLUMN: Record<TrialReminder, string> = {
  day5: "trial_reminder_day5_at",
  day7: "trial_reminder_day7_at",
};

/**
 * Claims the right to send one trial reminder, exactly once per company per
 * reminder.
 *
 * Two things can trigger the day-5 email — Stripe's
 * `customer.subscription.trial_will_end` webhook and the daily cron — and
 * webhooks retry. The write is conditional on the stamp still being null, so
 * whichever gets there first wins and every later attempt returns false.
 *
 * Returns true if the caller should send the email.
 */
export async function markTrialReminderSent(
  companyId: string,
  reminder: TrialReminder,
): Promise<boolean> {
  const admin = createAdminClient();
  const column = COLUMN[reminder];

  const { data, error } = await admin
    .from("subscriptions")
    .update({ [column]: new Date().toISOString() })
    .eq("company_id", companyId)
    .is(column, null)
    .select("company_id");

  if (error) {
    console.error("markTrialReminderSent failed", { companyId, reminder, error });
    return false;
  }

  return (data?.length ?? 0) > 0;
}
