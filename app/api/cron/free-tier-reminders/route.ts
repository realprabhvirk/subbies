import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyOwnerEmail } from "@/lib/onboarding";
import { getAppUrl } from "@/lib/app-url";
import {
  sendFreeTierEndingEmail,
  sendFreeTierEndedEmail,
} from "@/lib/email/billing";

export const runtime = "nodejs";

interface FreeRow {
  company_id: string;
  free_ends_at: string;
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
  const soon = new Date(now + 3 * 86_400_000).toISOString();
  const nowIso = new Date(now).toISOString();

  let endingSent = 0;
  let endedSent = 0;

  // "Ending soon" — free window closes within 3 days, not yet reminded.
  const { data: ending } = await admin
    .from("subscriptions")
    .select("company_id, free_ends_at")
    .eq("status", "free")
    .is("free_reminder_ending_at", null)
    .not("free_ends_at", "is", null)
    .lte("free_ends_at", soon)
    .gt("free_ends_at", nowIso);

  for (const row of (ending ?? []) as FreeRow[]) {
    const email = await getCompanyOwnerEmail(row.company_id);
    const daysLeft = Math.max(
      1,
      Math.ceil((new Date(row.free_ends_at).getTime() - now) / 86_400_000),
    );
    if (email) {
      await sendFreeTierEndingEmail({ to: email, daysLeft, upgradeUrl: billingUrl });
    }
    await admin
      .from("subscriptions")
      .update({ free_reminder_ending_at: nowIso })
      .eq("company_id", row.company_id);
    endingSent += 1;
  }

  // "Ended" — free window has closed, not yet reminded.
  const { data: ended } = await admin
    .from("subscriptions")
    .select("company_id, free_ends_at")
    .eq("status", "free")
    .is("free_reminder_ended_at", null)
    .not("free_ends_at", "is", null)
    .lte("free_ends_at", nowIso);

  for (const row of (ended ?? []) as FreeRow[]) {
    const email = await getCompanyOwnerEmail(row.company_id);
    if (email) {
      await sendFreeTierEndedEmail({ to: email, upgradeUrl: billingUrl });
    }
    await admin
      .from("subscriptions")
      .update({ free_reminder_ended_at: nowIso })
      .eq("company_id", row.company_id);
    endedSent += 1;
  }

  return Response.json({ ok: true, endingSent, endedSent });
}
