/**
 * Application types that mirror the Supabase schema.
 *
 * These are hand-written for now. If the schema grows, consider generating
 * them with `supabase gen types typescript`.
 */

export type ContractorStatus =
  | "pending"
  | "awaiting_review"
  | "approved"
  | "attention_required"
  | "expired";

export type DocumentStatus = "requested" | "uploaded" | "approved" | "rejected";

export interface Company {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface DocumentType {
  id: string;
  company_id: string;
  name: string;
  default_duration_months: number;
  reminder_days: number[];
  created_at: string;
}

export interface Contractor {
  id: string;
  company_id: string;
  business_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  trade: string | null;
  status: ContractorStatus;
  created_at: string;
}

export interface ContractorDocument {
  id: string;
  contractor_id: string;
  document_type_id: string;
  status: DocumentStatus;
  file_url: string | null;
  expiry_date: string | null;
  rejection_reason: string | null;
  reminder_count: number;
  created_at: string;
  updated_at: string;
}

export interface ContractorToken {
  id: string;
  contractor_id: string;
  token: string;
  created_at: string;
}
