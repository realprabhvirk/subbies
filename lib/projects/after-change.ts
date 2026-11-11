import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getSubscriptionRow } from "@/lib/billing/entitlements";
import { projectsForContractor, syncProjectStatuses } from "./status-sync";

/**
 * After something changed a contractor's documents or assignments: re-check
 * their standing on every open project they're on and record real changes.
 * Signed-in user only (RLS-scoped). Never throws.
 */
export async function syncAfterContractorChange(companyId: string, contractorId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const sub = await getSubscriptionRow(companyId);
    const projects = await projectsForContractor(supabase, contractorId, sub?.plan ?? null);
    await syncProjectStatuses(supabase, projects, contractorId);
  } catch (err) {
    console.error("syncAfterContractorChange threw", { err: String(err) });
  }
}

/** After a project's requirements or assignments changed: every contractor on it. */
export async function syncAfterProjectChange(companyId: string, projectId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const sub = await getSubscriptionRow(companyId);
    await syncProjectStatuses(supabase, [{ id: projectId, plan: sub?.plan ?? null }]);
  } catch (err) {
    console.error("syncAfterProjectChange threw", { err: String(err) });
  }
}
