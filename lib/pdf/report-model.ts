/**
 * What the PDF compliance report prints, built from the compliance engine's
 * output so the PDF can never disagree with the screen. Pure.
 *
 * Privacy by construction: the model only has names, trades, statuses and
 * dates. Contractor emails, phone numbers, ABNs, policy numbers and document
 * contents never enter it, so they can't reach the PDF.
 */
import type { ProjectCompliance, RequirementState, ProjectContractorStatus, EngineDocument } from "../compliance/project.ts";
import { describeDays } from "../compliance/project.ts";
import { daysUntilExpiry } from "../reminders/expiry-logic.ts";

export interface ReportRow {
  document: string;
  /** Optional requirements are shown but never decide the status. */
  mandatory: boolean;
  status: RequirementState;
  expiry: string;
  note: string;
}

export interface ReportContractor {
  name: string;
  trade: string | null;
  status: ProjectContractorStatus;
  rows: ReportRow[];
}

export interface ReportModel {
  companyName: string;
  projectName: string;
  address: string | null;
  projectStatus: string;
  dates: string | null;
  generatedAt: string;
  mode: "requirements" | "basic";
  percent: number | null;
  metrics: { label: string; value: number }[];
  contractors: ReportContractor[];
  /** PNG/JPEG bytes ready to embed, or null. */
  map: Buffer | null;
  /** The project has a saved location (so a missing map means the image failed). */
  hasLocation: boolean;
  photos: Buffer[];
}

export const STATUS_TEXT: Record<RequirementState, string> = {
  valid: "Valid",
  expiring: "Expiring soon",
  pending_review: "Pending review",
  rejected: "Rejected",
  expired: "Expired",
  missing: "Missing",
};

export const CONTRACTOR_STATUS_TEXT: Record<ProjectContractorStatus, string> = {
  compliant: "Cleared",
  expiring: "Expiring soon",
  pending_review: "Pending review",
  not_cleared: "Not cleared",
};

const PROJECT_STATUS: Record<string, string> = { active: "Active", on_hold: "On hold", completed: "Completed" };

const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "–");

function note(state: RequirementState, daysLeft: number | null, renewal: boolean): string {
  if (state === "missing") return "Missing";
  if (state === "rejected") return "Rejected, new copy needed";
  if (state === "pending_review") return "Waiting for review";
  if ((state === "expired" || state === "expiring") && daysLeft !== null) {
    const d = describeDays(daysLeft);
    return d.charAt(0).toUpperCase() + d.slice(1) + (renewal ? ", renewal pending" : "");
  }
  return "";
}

function basicState(d: EngineDocument, now: Date): { state: RequirementState; days: number | null } | null {
  if (d.status === "revoked") return null;
  if (d.status === "requested") return { state: "missing", days: null };
  if (d.status === "uploaded") return { state: "pending_review", days: null };
  if (d.status === "rejected") return { state: "rejected", days: null };
  const days = d.expiryDate ? daysUntilExpiry(d.expiryDate, now) : null;
  if (days === null) return { state: "valid", days };
  if (days < 0) return { state: "expired", days };
  return { state: days <= 30 ? "expiring" : "valid", days };
}

export function buildReportModel(input: {
  companyName: string;
  project: { name: string; address: string | null; status: string; start_date: string | null; end_date: string | null };
  locationAddress: string | null;
  compliance: ProjectCompliance;
  documents: EngineDocument[];
  now: Date;
  generatedAt: Date;
  map: Buffer | null;
  hasLocation?: boolean;
  photos: Buffer[];
}): ReportModel {
  const c = input.compliance;
  const contractors: ReportContractor[] = c.contractors.map((k) => {
    const rows: ReportRow[] =
      c.mode === "requirements"
        ? k.cells.map((cell) => ({
            document: cell.documentTypeName + (cell.isMandatory ? "" : " (optional)"),
            mandatory: cell.isMandatory,
            status: cell.state,
            expiry: cell.state === "missing" ? "–" : fmtDate(cell.expiryDate),
            note: !cell.isMandatory && cell.state === "missing" ? "Optional, not provided" : note(cell.state, cell.daysLeft, cell.renewalPending),
          }))
        : input.documents
            .filter((d) => d.contractorId === k.contractorId)
            .map((d) => ({ d, s: basicState(d, input.now) }))
            .filter((x): x is { d: EngineDocument; s: { state: RequirementState; days: number | null } } => x.s !== null)
            .map(({ d, s }) => ({
              document: d.documentTypeName,
              mandatory: true,
              status: s.state,
              expiry: s.state === "missing" ? "–" : fmtDate(d.expiryDate),
              note: note(s.state, s.days, false),
            }));
    return { name: k.businessName, trade: k.trade, status: k.status, rows };
  });

  // Counts are of mandatory documents: an optional one never makes a contractor not cleared.
  const cells = contractors.flatMap((k) => k.rows).filter((r) => r.mandatory);
  const count = (s: RequirementState) => cells.filter((r) => r.status === s).length;

  const dates =
    input.project.start_date || input.project.end_date
      ? `${fmtDate(input.project.start_date)} to ${fmtDate(input.project.end_date)}`
      : null;

  return {
    companyName: input.companyName,
    projectName: input.project.name,
    address: input.locationAddress ?? input.project.address,
    projectStatus: PROJECT_STATUS[input.project.status] ?? input.project.status,
    dates,
    generatedAt: new Intl.DateTimeFormat("en-AU", {
      day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Australia/Brisbane",
    }).format(input.generatedAt),
    mode: c.mode,
    percent: c.percent,
    metrics: [
      { label: "Contractors", value: c.assignedCount },
      { label: "Cleared", value: c.clearedCount },
      { label: "Not cleared", value: c.contractors.filter((k) => k.status === "not_cleared").length },
      { label: "Missing", value: count("missing") },
      { label: "Expired", value: count("expired") },
      { label: "Expiring", value: count("expiring") },
      { label: "Pending review", value: count("pending_review") },
    ],
    contractors,
    map: input.map,
    hasLocation: input.hasLocation ?? input.map !== null,
    photos: input.photos.slice(0, 3),
  };
}
