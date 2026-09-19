import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyOwnerEmail } from "@/lib/onboarding";
import { getAppUrl } from "@/lib/app-url";
import { recomputeContractorStatus } from "@/lib/contractor-status";
import {
  planReminders,
  groupByContractor,
  type ReminderCandidate,
  type ReminderDecision,
  type SentReminder,
} from "@/lib/reminders/expiry-logic";
import {
  sendExpiryReminderEmail,
  sendExpiryEscalationEmail,
} from "@/lib/email/expiry";
import type { SubscriptionStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily expiry-reminder cron.
 *
 * Nudges the contractor before each approved document lapses, on the schedule
 * the company set per document type (document_types.reminder_days), and
 * escalates to the company once one actually has. Both halves of what the
 * product advertises.
 *
 * Protected with CRON_SECRET, exactly like /api/cron/trial-reminders — this
 * route sends real email to real contractors, so it must never be
 * publicly triggerable:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/expiry-reminders
 *
 * Add ?dry=1 to report precisely what WOULD be sent without sending anything
 * or writing a single log row. Same auth — it reads across every company, so
 * it is not a public toggle.
 *
 * Uses the service-role client because it scans every company's documents by
 * design, which no user-scoped client can do. The authorization boundary is
 * therefore inside this file: the company list is built from paid
 * subscriptions, every contractor is fetched by its own company_id, and each
 * contractor's documents are fetched by that contractor's id — so a document
 * can only ever reach the contractor it belongs to, and an escalation can
 * only ever reach the company that owns the contractor.
 */

/** Matches PAID_STATUSES in lib/billing/sync.ts and paidAccess in entitlements.ts. */
const ACTIVE_STATUSES: SubscriptionStatus[] = ["trialing", "active", "past_due"];

interface DocRow {
  id: string;
  contractor_id: string;
  expiry_date: string | null;
  document_types: { name: string; reminder_days: number[] | null } | null;
}

interface ContractorRow {
  id: string;
  company_id: string;
  business_name: string;
  contact_name: string | null;
  email: string;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get("dry") === "1";
  const admin = createAdminClient();
  const today = new Date();

  let evaluated = 0;
  let remindersSent = 0;
  let escalationsSent = 0;
  let failed = 0;
  const preview: Record<string, unknown>[] = [];

  // 1. Companies with live access. Anything cancelled, unpaid or never
  //    started is skipped entirely — we don't email on behalf of an account
  //    that isn't paying. past_due is deliberately INCLUDED: this app already
  //    treats it as having access (Stripe is still retrying the card), and
  //    silently dropping compliance reminders during a card retry is the
  //    wrong failure for a safety feature.
  const { data: subs, error: subsError } = await admin
    .from("subscriptions")
    .select("company_id")
    .in("status", ACTIVE_STATUSES);

  if (subsError) {
    console.error("expiry-reminders: subscription query failed", subsError);
    return new Response("Subscription query failed", { status: 500 });
  }

  const companyIds = (subs ?? []).map((s) => s.company_id as string);
  if (companyIds.length === 0) {
    console.log("expiry-reminders: no active companies; nothing to do");
    return Response.json({ ok: true, dryRun, evaluated: 0, remindersSent: 0, escalationsSent: 0, failed: 0 });
  }

  // 2. Their contractors.
  const { data: contractorData, error: contractorError } = await admin
    .from("contractors")
    .select("id, company_id, business_name, contact_name, email")
    .in("company_id", companyIds);

  if (contractorError) {
    console.error("expiry-reminders: contractor query failed", contractorError);
    return new Response("Contractor query failed", { status: 500 });
  }

  const contractors = (contractorData ?? []) as ContractorRow[];
  if (contractors.length === 0) {
    console.log("expiry-reminders: no contractors under active companies");
    return Response.json({ ok: true, dryRun, evaluated: 0, remindersSent: 0, escalationsSent: 0, failed: 0 });
  }

  const contractorById = new Map(contractors.map((c) => [c.id, c]));

  // 3. Approved documents that carry an expiry date. Only "approved" — a
  //    document still being uploaded, rejected, or revoked has no expiry to
  //    chase, and its own flow already tells the contractor what to do.
  const { data: docData, error: docError } = await admin
    .from("contractor_documents")
    .select("id, contractor_id, expiry_date, document_types(name, reminder_days)")
    .in("contractor_id", [...contractorById.keys()])
    .eq("status", "approved")
    .not("expiry_date", "is", null);

  if (docError) {
    console.error("expiry-reminders: document query failed", docError);
    return new Response("Document query failed", { status: 500 });
  }

  const docs = (docData ?? []) as unknown as DocRow[];
  evaluated = docs.length;
  if (docs.length === 0) {
    console.log("expiry-reminders: evaluated 0 | sent 0 | escalated 0 | failed 0");
    return Response.json({ ok: true, dryRun, evaluated: 0, remindersSent: 0, escalationsSent: 0, failed: 0 });
  }

  // 4. What has already gone out, so nothing is sent twice.
  const { data: logData, error: logError } = await admin
    .from("expiry_reminder_log")
    .select("contractor_document_id, expiry_date, threshold")
    .in("contractor_document_id", docs.map((d) => d.id));

  if (logError) {
    // Fail closed here, on purpose and in the opposite direction to the trial
    // ledger's fail-open. There the risk was denying something owed; here an
    // unreadable log means we cannot tell what has already been sent, and
    // guessing "nothing" re-emails every contractor every document they have.
    // Sending nothing today is recoverable; spamming every contractor is not.
    console.error("expiry-reminders: reminder log unreadable, sending nothing this run", logError);
    return new Response("Reminder log unreadable", { status: 500 });
  }

  const alreadySent: SentReminder[] = (logData ?? []).map((r) => ({
    documentId: r.contractor_document_id as string,
    expiryDate: r.expiry_date as string,
    threshold: r.threshold as string,
  }));

  const candidates: ReminderCandidate[] = docs
    .filter((d) => d.expiry_date !== null && contractorById.has(d.contractor_id))
    .map((d) => ({
      documentId: d.id,
      contractorId: d.contractor_id,
      documentName: d.document_types?.name ?? "Document",
      reminderDays: d.document_types?.reminder_days ?? [],
      expiryDate: d.expiry_date!,
    }));

  const decisions = planReminders(candidates, alreadySent, today);

  const appUrl = await getAppUrl();

  /** Writes the log rows for one decision. Unique index makes a re-run a no-op. */
  const recordSent = async (items: ReminderDecision[]): Promise<void> => {
    const rows = items.flatMap((d) =>
      d.thresholds.map((t) => ({
        contractor_document_id: d.documentId,
        contractor_id: d.contractorId,
        expiry_date: d.expiryDate,
        threshold: t,
      })),
    );
    if (rows.length === 0) return;
    const { error } = await admin.from("expiry_reminder_log").insert(rows);
    if (error) {
      // Logged loudly rather than thrown: the email is already delivered, so
      // aborting here would guarantee a duplicate on the next run instead of
      // preventing one.
      console.error("expiry-reminders: failed to record sent reminders", {
        code: error.code,
        message: error.message,
        rows: rows.length,
      });
    }
  };

  // --- contractor-facing reminders (pre-expiry) ----------------------------
  const upcoming = decisions.filter((d) => !d.overdue);
  for (const [contractorId, items] of groupByContractor(upcoming)) {
    const contractor = contractorById.get(contractorId);
    if (!contractor) continue;

    // The token is per-contractor and is the contractor's only way in.
    const { data: tokenRow } = await admin
      .from("contractor_tokens")
      .select("token")
      .eq("contractor_id", contractorId)
      .maybeSingle<{ token: string }>();

    if (!tokenRow) {
      console.error("expiry-reminders: contractor has no upload link, skipping", { contractorId });
      failed += 1;
      continue;
    }

    const { data: company } = await admin
      .from("companies")
      .select("name")
      .eq("id", contractor.company_id)
      .maybeSingle<{ name: string }>();

    const ownerEmail = await getCompanyOwnerEmail(contractor.company_id);

    if (dryRun) {
      preview.push({
        kind: "contractor_reminder",
        to: contractor.email,
        contractor: contractor.business_name,
        documents: items.map((i) => ({
          name: i.documentName,
          expires: i.expiryDate,
          daysLeft: i.daysLeft,
          thresholds: i.thresholds,
        })),
      });
      remindersSent += 1;
      continue;
    }

    const result = await sendExpiryReminderEmail({
      to: contractor.email,
      contactName: contractor.contact_name,
      companyName: company?.name ?? "Your client",
      replyTo: ownerEmail,
      documents: items.map((i) => ({
        documentName: i.documentName,
        expiryDate: i.expiryDate,
        daysLeft: i.daysLeft,
      })),
      onboardUrl: `${appUrl}/onboard/${tokenRow.token}`,
    });

    if (!result.ok) {
      // One bad send never aborts the batch — the rest of the run still goes.
      console.error("expiry-reminders: contractor email failed", {
        contractorId,
        reason: result.reason,
      });
      failed += 1;
      continue;
    }

    // Recorded immediately after a confirmed send, per contractor, so a crash
    // mid-batch can't cause the ones already delivered to go out again.
    await recordSent(items);
    remindersSent += 1;
  }

  // --- company-facing escalation (post-expiry) -----------------------------
  const overdue = decisions.filter((d) => d.overdue);
  const byCompany = new Map<string, ReminderDecision[]>();
  for (const d of overdue) {
    const contractor = contractorById.get(d.contractorId);
    if (!contractor) continue;
    const list = byCompany.get(contractor.company_id) ?? [];
    list.push(d);
    byCompany.set(contractor.company_id, list);
  }

  for (const [companyId, items] of byCompany) {
    const ownerEmail = await getCompanyOwnerEmail(companyId);
    if (!ownerEmail) {
      console.error("expiry-reminders: no owner email for company, skipping escalation", { companyId });
      failed += 1;
      continue;
    }

    const lines = items.map((i) => ({
      contractorName: contractorById.get(i.contractorId)?.business_name ?? "A contractor",
      documentName: i.documentName,
      expiryDate: i.expiryDate,
      daysOverdue: Math.abs(i.daysLeft),
    }));

    if (dryRun) {
      preview.push({ kind: "company_escalation", to: ownerEmail, documents: lines });
      escalationsSent += 1;
      continue;
    }

    const result = await sendExpiryEscalationEmail({
      to: ownerEmail,
      documents: lines,
      dashboardUrl: `${appUrl}/dashboard/contractors`,
    });

    if (!result.ok) {
      console.error("expiry-reminders: escalation email failed", { companyId, reason: result.reason });
      failed += 1;
      continue;
    }

    await recordSent(items);
    escalationsSent += 1;
  }

  // A contractor whose document has lapsed should also READ as expired in the
  // dashboard. deriveContractorStatus already derives that from the expiry
  // date, but only ever runs on a document mutation — and an expiry passing
  // isn't one, so the badge stays stale until someone happens to touch the
  // document. This is the scheduled job that "note: handled by the Phase 2
  // scheduled job" in lib/contractor-status.ts was always waiting for.
  // Scoped to contractors we already determined have a lapsed document, so it
  // costs nothing on a quiet day.
  if (!dryRun) {
    const expiredContractorIds = new Set(overdue.map((d) => d.contractorId));
    for (const contractorId of expiredContractorIds) {
      await recomputeContractorStatus(admin, contractorId);
    }
  }

  // One line a non-technical founder can read in the Vercel logs.
  console.log(
    `expiry-reminders:${dryRun ? " DRY RUN |" : ""} evaluated ${evaluated} | reminders ${remindersSent} | escalations ${escalationsSent} | failed ${failed}`,
  );

  return Response.json({
    ok: true,
    dryRun,
    evaluated,
    remindersSent,
    escalationsSent,
    failed,
    ...(dryRun ? { wouldSend: preview } : {}),
  });
}
