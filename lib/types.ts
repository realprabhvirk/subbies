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
  address: string | null;
  phone: string | null;
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

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

export interface Subscription {
  id: string;
  company_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: "starter" | "business" | "pro" | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export type ProjectStatus = "active" | "on_hold" | "completed";

export interface Project {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface ProjectContractor {
  id: string;
  project_id: string;
  contractor_id: string;
  role_on_project: string | null;
  assigned_at: string;
  removed_at: string | null;
}

export type NotificationType =
  | "document_uploaded"
  | "contractor_approved"
  | "document_rejected";

export interface AppNotification {
  id: string;
  company_id: string;
  contractor_id: string | null;
  type: NotificationType;
  message: string;
  read_at: string | null;
  created_at: string;
}
