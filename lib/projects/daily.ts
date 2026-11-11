import "server-only";

import { isPlanId, type PlanId } from "@/lib/billing/plans";
import { recordProjectActivityAsServer } from "./activity";
import { syncProjectStatusesAsServer } from "./status-sync";
import type { RpcClient } from "./activity";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = RpcClient & { from(table: string): any };

const DAY_MS = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const fmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * The project side of the daily job (runs inside the existing expiry
 * reminders cron; no second cron entry):
 *
 * 1. document_expired for each approved document that lapsed in the last two
 *    days, on every open project its contractor is on. Idempotent (unique
 *    index), and deliberately not a backfill: older expiries are history we
 *    didn't record at the time, so they aren't invented now. Two days, not
 *    one, so a single missed run doesn't lose an event.
 * 2. Status sync for every open project, so time-driven changes (into
 *    "expiring" or "not cleared") are recorded once.
 *
 * Never throws; returns counts for the log line.
 */
export async function runProjectDailyJob(
  admin: Admin,
  companyIds: string[],
  today: Date,
): Promise<{ expiredEvents: number; statusChanges: number }> {
  let expiredEvents = 0;
  let statusChanges = 0;
  if (companyIds.length === 0) return { expiredEvents, statusChanges };

  try {
    const { data: assignData, error: assignError } = await admin
      .from("project_contractors")
      .select("project_id, contractor_id, projects!inner(company_id, status), contractors!inner(business_name, archived_at)")
      .in("projects.company_id", companyIds)
      .neq("projects.status", "completed")
      .is("removed_at", null);
    if (assignError) {
      console.error("project daily job: assignments query failed", { code: assignError.code });
      return { expiredEvents, statusChanges };
    }

    type Row = {
      project_id: string;
      contractor_id: string;
      projects: { company_id: string; status: string };
      contractors: { business_name: string; archived_at: string | null };
    };
    const rows = ((assignData ?? []) as Row[]).filter((r) => !r.contractors.archived_at);

    // 1. Recent expiries.
    const contractorIds = [...new Set(rows.map((r) => r.contractor_id))];
    if (contractorIds.length > 0) {
      const from = isoDate(new Date(today.getTime() - 2 * DAY_MS));
      const to = isoDate(new Date(today.getTime() - 1 * DAY_MS));
      const { data: docs, error: docError } = await admin
        .from("contractor_documents")
        .select("id, contractor_id, expiry_date, document_types(name)")
        .in("contractor_id", contractorIds)
        .eq("status", "approved")
        .is("archived_at", null)
        .gte("expiry_date", from)
        .lte("expiry_date", to);
      if (docError) {
        console.error("project daily job: documents query failed", { code: docError.code });
      } else {
        for (const d of (docs ?? []) as { id: string; contractor_id: string; expiry_date: string; document_types: { name: string } | null }[]) {
          for (const r of rows.filter((x) => x.contractor_id === d.contractor_id)) {
            const wrote = await recordProjectActivityAsServer(admin, {
              companyId: r.projects.company_id,
              projectId: r.project_id,
              eventType: "document_expired",
              description: `${d.document_types?.name ?? "A document"} for ${r.contractors.business_name} expired on ${fmt.format(new Date(`${d.expiry_date}T00:00:00Z`))}`,
              contractorId: d.contractor_id,
              documentId: d.id,
              metadata: { expiry_date: d.expiry_date },
            });
            if (wrote) expiredEvents += 1;
          }
        }
      }
    }

    // 2. Status sync, one company at a time.
    const { data: subs } = await admin.from("subscriptions").select("company_id, plan").in("company_id", companyIds);
    const planOf = new Map<string, PlanId | null>(
      ((subs ?? []) as { company_id: string; plan: string | null }[]).map((s) => [s.company_id, isPlanId(s.plan) ? s.plan : null]),
    );
    const projectsByCompany = new Map<string, Set<string>>();
    for (const r of rows) {
      const set = projectsByCompany.get(r.projects.company_id) ?? new Set<string>();
      set.add(r.project_id);
      projectsByCompany.set(r.projects.company_id, set);
    }
    for (const [companyId, ids] of projectsByCompany) {
      const plan = planOf.get(companyId) ?? null;
      statusChanges += await syncProjectStatusesAsServer(admin, companyId, [...ids].map((id) => ({ id, plan })));
    }
  } catch (err) {
    console.error("project daily job threw", { err: String(err) });
  }
  return { expiredEvents, statusChanges };
}
