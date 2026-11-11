/**
 * The project compliance engine. One pure function, no database and no clock
 * (the caller passes `now`), so every surface that shows a project's
 * compliance (workspace tabs, register, analytics, PDF) gets the same answer
 * and it can be tested exhaustively.
 *
 * `now` is complianceToday(): UTC midnight of today's Queensland date, the
 * same "today" the reminder job and the dashboard use. Expiry dates are plain
 * calendar dates compared with daysUntilExpiry, so a document expiring today
 * still counts as valid today and expired tomorrow, exactly like the emails.
 */
import { EXPIRING_WINDOW_DAYS } from "../dashboard-buckets.ts";
import { daysUntilExpiry } from "../reminders/expiry-logic.ts";
import type { ContractorStatus, DocumentStatus } from "../types.ts";

export { EXPIRING_WINDOW_DAYS };

export type RequirementState =
  | "valid"
  | "expiring"
  | "pending_review"
  | "rejected"
  | "expired"
  | "missing";

export type ProjectContractorStatus = "compliant" | "expiring" | "pending_review" | "not_cleared";

export interface EngineRequirement {
  id: string;
  documentTypeId: string;
  documentTypeName: string;
  isMandatory: boolean;
  /** Approved documents must stay valid for at least this many days. */
  minDaysValid: number | null;
}

export interface EngineContractor {
  id: string;
  businessName: string;
  trade: string | null;
  /** The contractor's overall status, used in basic mode. */
  status: ContractorStatus;
  archived: boolean;
}

export interface EngineDocument {
  id: string;
  contractorId: string;
  documentTypeId: string;
  documentTypeName: string;
  status: DocumentStatus;
  expiryDate: string | null;
  /** Live documents only: archived history rows must be filtered out by the loader. */
  updatedAt: string;
  createdAt: string;
}

export interface RequirementCell {
  requirementId: string;
  documentTypeId: string;
  documentTypeName: string;
  isMandatory: boolean;
  state: RequirementState;
  /** The document the state was decided from, if any. */
  documentId: string | null;
  expiryDate: string | null;
  /** Days until expiry of the deciding document (negative once expired). */
  daysLeft: number | null;
  /** Expiring, but a newer copy is already waiting for review. */
  renewalPending: boolean;
}

export interface ContractorCompliance {
  contractorId: string;
  businessName: string;
  trade: string | null;
  status: ProjectContractorStatus;
  /** One per requirement, in requirement order. Empty in basic mode. */
  cells: RequirementCell[];
  /** Mandatory requirements that are valid or expiring, of all mandatory ones. */
  mandatoryMet: number;
  mandatoryTotal: number;
}

export type AttentionIssue = "expired" | "rejected" | "missing" | "pending_review" | "expiring";

export interface AttentionItem {
  contractorId: string;
  businessName: string;
  issue: AttentionIssue;
  /** "Public liability insurance: expired 3 days ago". */
  text: string;
  documentId: string | null;
  documentTypeId: string | null;
  /** Sorts most urgent first. */
  rank: number;
}

export interface ProjectCompliance {
  mode: "requirements" | "basic";
  contractors: ContractorCompliance[];
  /** Assigned, non-archived contractors. */
  assignedCount: number;
  /** compliant or expiring. */
  clearedCount: number;
  /** 0 to 100, or null when nobody is assigned (never shown as 0% or 100%). */
  percent: number | null;
  /** Mandatory contractor-requirement pairs not valid or expiring. Basic mode: contractors not cleared. */
  outstandingMandatory: number;
  /** Documents expiring within the warning window on this project. */
  expiringCount: number;
  needsAttention: AttentionItem[];
}

export interface ComplianceInput {
  requirements: EngineRequirement[];
  contractors: EngineContractor[];
  documents: EngineDocument[];
  now: Date;
  expiryWarningDays?: number;
  /** "requirements" falls back to basic when the project has none. */
  mode: "requirements" | "basic";
}

const ISSUE_RANK: Record<AttentionIssue, number> = {
  expired: 0,
  rejected: 1,
  missing: 2,
  pending_review: 3,
  expiring: 4,
};

/** "expired 3 days ago", "expires today", "expires in 12 days". */
export function describeDays(daysLeft: number): string {
  if (daysLeft < 0) {
    const ago = -daysLeft;
    return `expired ${ago} ${ago === 1 ? "day" : "days"} ago`;
  }
  if (daysLeft === 0) return "expires today";
  return `expires in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`;
}

const newestFirst = (a: EngineDocument, b: EngineDocument) =>
  b.updatedAt.localeCompare(a.updatedAt) || b.createdAt.localeCompare(a.createdAt);

/**
 * The state of one requirement for one contractor, from that contractor's
 * live documents of that type. `requested` rows (asked for, nothing
 * provided) and `revoked` rows count as nothing.
 */
export function evaluateRequirement(
  docs: EngineDocument[],
  now: Date,
  warningDays: number,
  minDaysValid: number | null,
): Pick<RequirementCell, "state" | "documentId" | "expiryDate" | "daysLeft" | "renewalPending"> {
  const usable = docs.filter((d) => d.status !== "requested" && d.status !== "revoked");
  const pending = usable.filter((d) => d.status === "uploaded").sort(newestFirst);

  // Best approved copy that hasn't expired: no expiry beats any date, then
  // the latest expiry.
  const approved = usable
    .filter((d) => d.status === "approved")
    .map((d) => ({ d, days: d.expiryDate ? daysUntilExpiry(d.expiryDate, now) : null }));
  const current = approved
    .filter((x) => x.days === null || x.days >= 0)
    .sort((a, b) => (a.days === null ? -1 : b.days === null ? 1 : b.days - a.days))[0];

  if (current) {
    const days = current.days;
    const clearsWindow = days === null || days > warningDays;
    const clearsMinimum = minDaysValid === null || days === null || days >= minDaysValid;
    const renewalPending = pending.some((p) => p.createdAt > current.d.createdAt);
    return {
      state: clearsWindow && clearsMinimum ? "valid" : "expiring",
      documentId: current.d.id,
      expiryDate: current.d.expiryDate,
      daysLeft: days,
      renewalPending: !(clearsWindow && clearsMinimum) && renewalPending,
    };
  }

  if (pending[0]) {
    return { state: "pending_review", documentId: pending[0].id, expiryDate: pending[0].expiryDate, daysLeft: null, renewalPending: false };
  }

  const latest = [...usable].sort(newestFirst)[0];
  if (latest?.status === "rejected") {
    return { state: "rejected", documentId: latest.id, expiryDate: null, daysLeft: null, renewalPending: false };
  }

  const lapsed = approved
    .filter((x) => x.days !== null && x.days < 0)
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0))[0];
  if (lapsed) {
    return { state: "expired", documentId: lapsed.d.id, expiryDate: lapsed.d.expiryDate, daysLeft: lapsed.days, renewalPending: false };
  }

  return { state: "missing", documentId: null, expiryDate: null, daysLeft: null, renewalPending: false };
}

function statusFromCells(cells: RequirementCell[]): ProjectContractorStatus {
  const mandatory = cells.filter((c) => c.isMandatory);
  if (mandatory.some((c) => c.state === "missing" || c.state === "expired" || c.state === "rejected")) {
    return "not_cleared";
  }
  if (mandatory.some((c) => c.state === "pending_review")) return "pending_review";
  if (mandatory.some((c) => c.state === "expiring")) return "expiring";
  return "compliant";
}

/** Basic mode: the contractor's own status, sharpened by their live documents. */
function basicStatus(
  contractor: EngineContractor,
  docs: EngineDocument[],
  now: Date,
  warningDays: number,
): { status: ProjectContractorStatus; expired: EngineDocument[]; expiring: EngineDocument[] } {
  const approved = docs.filter((d) => d.status === "approved" && d.expiryDate);
  const days = (d: EngineDocument) => daysUntilExpiry(d.expiryDate!, now) ?? Infinity;
  const expired = approved.filter((d) => days(d) < 0);
  const expiring = approved.filter((d) => days(d) >= 0 && days(d) <= warningDays);

  if (contractor.status === "approved") {
    if (expired.length > 0) return { status: "not_cleared", expired, expiring };
    return { status: expiring.length > 0 ? "expiring" : "compliant", expired, expiring };
  }
  if (contractor.status === "awaiting_review") return { status: "pending_review", expired, expiring };
  return { status: "not_cleared", expired, expiring };
}

const BASIC_ISSUE: Partial<Record<ContractorStatus, { issue: AttentionIssue; text: string }>> = {
  pending: { issue: "missing", text: "Documents not provided yet" },
  awaiting_review: { issue: "pending_review", text: "Documents waiting for your review" },
  attention_required: { issue: "rejected", text: "A document was rejected and needs a new copy" },
  expired: { issue: "expired", text: "A required document has expired" },
};

export function computeProjectCompliance(input: ComplianceInput): ProjectCompliance {
  const warningDays = input.expiryWarningDays ?? EXPIRING_WINDOW_DAYS;
  const mode = input.mode === "requirements" && input.requirements.length > 0 ? "requirements" : "basic";
  const live = input.contractors.filter((c) => !c.archived);

  const docsByContractor = new Map<string, EngineDocument[]>();
  for (const d of input.documents) {
    const list = docsByContractor.get(d.contractorId) ?? [];
    list.push(d);
    docsByContractor.set(d.contractorId, list);
  }

  const contractors: ContractorCompliance[] = [];
  const needsAttention: AttentionItem[] = [];
  let outstandingMandatory = 0;
  let expiringCount = 0;

  for (const c of live) {
    const docs = docsByContractor.get(c.id) ?? [];

    if (mode === "basic") {
      const { status, expired, expiring } = basicStatus(c, docs, input.now, warningDays);
      expiringCount += expiring.length;
      if (status === "not_cleared") outstandingMandatory += 1;
      contractors.push({ contractorId: c.id, businessName: c.businessName, trade: c.trade, status, cells: [], mandatoryMet: 0, mandatoryTotal: 0 });

      for (const d of expired) {
        const days = daysUntilExpiry(d.expiryDate!, input.now)!;
        needsAttention.push({ contractorId: c.id, businessName: c.businessName, issue: "expired", text: `${d.documentTypeName}: ${describeDays(days)}`, documentId: d.id, documentTypeId: d.documentTypeId, rank: ISSUE_RANK.expired });
      }
      if (expired.length === 0 && BASIC_ISSUE[c.status]) {
        const b = BASIC_ISSUE[c.status]!;
        needsAttention.push({ contractorId: c.id, businessName: c.businessName, issue: b.issue, text: b.text, documentId: null, documentTypeId: null, rank: ISSUE_RANK[b.issue] });
      }
      for (const d of expiring) {
        const days = daysUntilExpiry(d.expiryDate!, input.now)!;
        needsAttention.push({ contractorId: c.id, businessName: c.businessName, issue: "expiring", text: `${d.documentTypeName}: ${describeDays(days)}`, documentId: d.id, documentTypeId: d.documentTypeId, rank: ISSUE_RANK.expiring });
      }
      continue;
    }

    const cells: RequirementCell[] = input.requirements.map((r) => {
      const ofType = docs.filter((d) => d.documentTypeId === r.documentTypeId);
      return {
        requirementId: r.id,
        documentTypeId: r.documentTypeId,
        documentTypeName: r.documentTypeName,
        isMandatory: r.isMandatory,
        ...evaluateRequirement(ofType, input.now, warningDays, r.minDaysValid),
      };
    });

    const mandatory = cells.filter((x) => x.isMandatory);
    const met = mandatory.filter((x) => x.state === "valid" || x.state === "expiring").length;
    outstandingMandatory += mandatory.length - met;
    expiringCount += cells.filter((x) => x.state === "expiring").length;

    contractors.push({
      contractorId: c.id,
      businessName: c.businessName,
      trade: c.trade,
      status: statusFromCells(cells),
      cells,
      mandatoryMet: met,
      mandatoryTotal: mandatory.length,
    });

    for (const cell of cells) {
      if (cell.state === "valid") continue;
      // Optional requirements are shown, but only an expiring one is worth a
      // nudge; a missing optional document isn't an issue.
      if (!cell.isMandatory && cell.state !== "expiring") continue;
      const issue = cell.state as AttentionIssue;
      const detail =
        cell.state === "expired" || cell.state === "expiring"
          ? describeDays(cell.daysLeft ?? 0) + (cell.renewalPending ? ", renewal waiting for review" : "")
          : cell.state === "missing"
            ? "not provided"
            : cell.state === "rejected"
              ? "rejected, new copy needed"
              : "waiting for your review";
      needsAttention.push({
        contractorId: c.id,
        businessName: c.businessName,
        issue,
        text: `${cell.documentTypeName}: ${detail}`,
        documentId: cell.documentId,
        documentTypeId: cell.documentTypeId,
        rank: ISSUE_RANK[issue],
      });
    }
  }

  needsAttention.sort((a, b) => a.rank - b.rank || a.businessName.localeCompare(b.businessName));
  const clearedCount = contractors.filter((c) => c.status === "compliant" || c.status === "expiring").length;

  return {
    mode,
    contractors,
    assignedCount: live.length,
    clearedCount,
    percent: live.length === 0 ? null : Math.round((clearedCount / live.length) * 100),
    outstandingMandatory,
    expiringCount,
    needsAttention,
  };
}
