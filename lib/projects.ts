import type { ContractorStatus } from "@/lib/types";

/**
 * A contractor is "on-site ready" only when every required document is approved
 * and current. Anything else — missing docs, awaiting review, rejected,
 * expired — is a compliance issue worth surfacing on the project.
 */
export function hasComplianceIssue(status: ContractorStatus): boolean {
  return status !== "approved";
}

export interface AssignedContractor {
  projectContractorId: string;
  contractorId: string;
  businessName: string;
  trade: string | null;
  roleOnProject: string | null;
  status: ContractorStatus;
  assignedAt: string;
}

export function projectIssueCount(assigned: AssignedContractor[]): number {
  return assigned.filter((a) => hasComplianceIssue(a.status)).length;
}
