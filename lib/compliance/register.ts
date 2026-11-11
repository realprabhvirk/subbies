/**
 * The project document register: one row per contractor and requirement
 * (requirements mode) or per live document (basic mode), built from the
 * engine's output so its statuses match every other surface. Pure; filtered,
 * sorted and paginated on the server.
 */
import { daysUntilExpiry } from "../reminders/expiry-logic.ts";
import type { EngineDocument, ProjectCompliance, RequirementState } from "./project.ts";
import { EXPIRING_WINDOW_DAYS } from "./project.ts";

export const REGISTER_FILTERS = [
  { id: "all", label: "All" },
  { id: "missing", label: "Missing" },
  { id: "expired", label: "Expired" },
  { id: "expiring", label: "Expiring soon" },
  { id: "pending_review", label: "Pending review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
] as const;
export type RegisterFilter = (typeof REGISTER_FILTERS)[number]["id"];

export const REGISTER_PAGE_SIZE = 25;

export interface RegisterRow {
  key: string;
  contractorId: string;
  contractorName: string;
  documentTypeId: string;
  documentTypeName: string;
  state: RequirementState;
  documentId: string | null;
  expiryDate: string | null;
  daysLeft: number | null;
  /** When an approve or reject last touched it (approved or rejected only). */
  reviewedAt: string | null;
  updatedAt: string | null;
  mandatory: boolean;
}

const URGENCY: Record<RequirementState, number> = {
  expired: 0,
  rejected: 1,
  missing: 2,
  pending_review: 3,
  expiring: 4,
  valid: 5,
};

export function parseRegisterFilter(v: string | string[] | undefined): RegisterFilter {
  return typeof v === "string" && REGISTER_FILTERS.some((f) => f.id === v) ? (v as RegisterFilter) : "all";
}

export function parsePage(v: string | string[] | undefined): number {
  const n = typeof v === "string" ? Number(v) : 1;
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function matches(filter: RegisterFilter, state: RequirementState): boolean {
  if (filter === "all") return true;
  if (filter === "approved") return state === "valid" || state === "expiring";
  return state === filter;
}

function docState(d: EngineDocument, now: Date, warningDays: number): { state: RequirementState; daysLeft: number | null } | null {
  if (d.status === "revoked") return null;
  if (d.status === "requested") return { state: "missing", daysLeft: null };
  if (d.status === "uploaded") return { state: "pending_review", daysLeft: null };
  if (d.status === "rejected") return { state: "rejected", daysLeft: null };
  const days = d.expiryDate ? daysUntilExpiry(d.expiryDate, now) : null;
  if (days === null) return { state: "valid", daysLeft: null };
  if (days < 0) return { state: "expired", daysLeft: days };
  return { state: days <= warningDays ? "expiring" : "valid", daysLeft: days };
}

export function buildRegister(input: {
  compliance: ProjectCompliance;
  documents: EngineDocument[];
  now: Date;
  expiryWarningDays?: number;
}): RegisterRow[] {
  const warningDays = input.expiryWarningDays ?? EXPIRING_WINDOW_DAYS;
  const docById = new Map(input.documents.map((d) => [d.id, d]));
  const rows: RegisterRow[] = [];

  for (const c of input.compliance.contractors) {
    if (input.compliance.mode === "requirements") {
      for (const cell of c.cells) {
        const d = cell.documentId ? docById.get(cell.documentId) : undefined;
        rows.push({
          key: `${c.contractorId}:${cell.requirementId}`,
          contractorId: c.contractorId,
          contractorName: c.businessName,
          documentTypeId: cell.documentTypeId,
          documentTypeName: cell.documentTypeName,
          state: cell.state,
          documentId: cell.documentId,
          expiryDate: cell.expiryDate,
          daysLeft: cell.daysLeft,
          reviewedAt: d && (d.status === "approved" || d.status === "rejected") ? d.updatedAt : null,
          updatedAt: d?.updatedAt ?? null,
          mandatory: cell.isMandatory,
        });
      }
    } else {
      for (const d of input.documents.filter((x) => x.contractorId === c.contractorId)) {
        const s = docState(d, input.now, warningDays);
        if (!s) continue;
        rows.push({
          key: `${c.contractorId}:${d.id}`,
          contractorId: c.contractorId,
          contractorName: c.businessName,
          documentTypeId: d.documentTypeId,
          documentTypeName: d.documentTypeName,
          state: s.state,
          documentId: d.status === "requested" ? null : d.id,
          expiryDate: d.expiryDate,
          daysLeft: s.daysLeft,
          reviewedAt: d.status === "approved" || d.status === "rejected" ? d.updatedAt : null,
          updatedAt: d.updatedAt,
          mandatory: true,
        });
      }
    }
  }

  return rows.sort(
    (a, b) =>
      URGENCY[a.state] - URGENCY[b.state] ||
      (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity) ||
      a.contractorName.localeCompare(b.contractorName) ||
      a.documentTypeName.localeCompare(b.documentTypeName),
  );
}

export function filterAndPage(
  rows: RegisterRow[],
  filter: RegisterFilter,
  page: number,
  pageSize = REGISTER_PAGE_SIZE,
): { rows: RegisterRow[]; counts: Record<RegisterFilter, number>; page: number; pages: number; total: number } {
  const counts = Object.fromEntries(REGISTER_FILTERS.map((f) => [f.id, rows.filter((r) => matches(f.id, r.state)).length])) as Record<RegisterFilter, number>;
  const filtered = rows.filter((r) => matches(filter, r.state));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  return {
    rows: filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    counts,
    page: safePage,
    pages,
    total: filtered.length,
  };
}
