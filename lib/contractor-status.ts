import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContractorStatus, DocumentStatus } from "@/lib/types";

interface StatusInputDoc {
  status: DocumentStatus;
  expiry_date: string | null;
}

function isPast(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr).getTime() < today.getTime();
}

/**
 * Derives a contractor's overall status from their document rows.
 *
 * Precedence (worst first):
 *   expired            — an approved document is past its expiry date
 *   attention_required — a document was rejected and needs re-uploading
 *   awaiting_review    — a document is uploaded and waiting on the company
 *   pending            — a requested document has not been uploaded yet
 *   approved           — every document is approved and current
 *
 * Note: time-based flips (a document expiring while nothing else changes)
 * are handled by the Phase 2 scheduled job. This runs on every document
 * mutation.
 */
export function deriveContractorStatus(
  docs: StatusInputDoc[],
): ContractorStatus {
  if (docs.length === 0) return "pending";

  const hasExpired = docs.some(
    (d) => d.status === "approved" && isPast(d.expiry_date),
  );
  if (hasExpired) return "expired";

  if (docs.some((d) => d.status === "rejected")) return "attention_required";
  if (docs.some((d) => d.status === "uploaded")) return "awaiting_review";
  if (docs.some((d) => d.status === "requested")) return "pending";

  return "approved";
}

/**
 * Recomputes and persists a contractor's cached `status` column. Accepts any
 * Supabase client — the authed client for company actions (RLS applies), or
 * the admin client for the token-based contractor flow.
 *
 * Returns the new status, or null if the contractor's documents couldn't be
 * read.
 */
export async function recomputeContractorStatus(
  supabase: SupabaseClient,
  contractorId: string,
): Promise<ContractorStatus | null> {
  const { data, error } = await supabase
    .from("contractor_documents")
    .select("status, expiry_date")
    .eq("contractor_id", contractorId);

  if (error || !data) {
    console.error("recomputeContractorStatus: read failed", error);
    return null;
  }

  const status = deriveContractorStatus(data as StatusInputDoc[]);

  const { error: updateError } = await supabase
    .from("contractors")
    .update({ status })
    .eq("id", contractorId);

  if (updateError) {
    console.error("recomputeContractorStatus: update failed", updateError);
    return null;
  }

  return status;
}
