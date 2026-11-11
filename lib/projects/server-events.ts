import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isPlanId, type PlanId } from "@/lib/billing/plans";
import { recordContractorActivityAsServer } from "./activity";
import { projectsForContractor, syncProjectStatusesAsServer } from "./status-sync";

async function planFor(admin: ReturnType<typeof createAdminClient>, companyId: string): Promise<PlanId | null> {
  const { data } = await admin.from("subscriptions").select("plan").eq("company_id", companyId).maybeSingle<{ plan: string | null }>();
  return isPlanId(data?.plan) ? data.plan : null;
}

/**
 * A contractor submitted a document through their upload link. There's no
 * signed-in user, so this uses the service role with ids the token route
 * resolved server-side. Fans out to every project they're on. Never throws.
 */
export async function afterTokenUpload(input: {
  companyId: string;
  contractorId: string;
  businessName: string;
  documentName: string;
  documentId: string;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    await recordContractorActivityAsServer(admin, {
      companyId: input.companyId,
      contractorId: input.contractorId,
      eventType: "document_uploaded",
      description: `${input.businessName} uploaded ${input.documentName}`,
      documentId: input.documentId,
    });
    const plan = await planFor(admin, input.companyId);
    const projects = await projectsForContractor(admin, input.contractorId, plan);
    await syncProjectStatusesAsServer(admin, input.companyId, projects, input.contractorId);
  } catch (err) {
    console.error("afterTokenUpload threw", { err: String(err) });
  }
}
