import "server-only";

import { getCompany, getUser, type AuthUser } from "@/lib/supabase/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlement } from "@/lib/billing/entitlements";
import { statusHasAccess } from "@/lib/billing/access-statuses";
import { NO_ACCESS_MESSAGE_TEXT } from "@/lib/billing/messages";
import type { Company, SubscriptionStatus } from "@/lib/types";

export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Reload and try again.";
export const NO_ACCESS_MESSAGE = NO_ACCESS_MESSAGE_TEXT;

export type ActiveCompanyResult =
  | { ok: true; company: Company; user: AuthUser | null }
  | { ok: false; reason: "no_session" | "no_access"; error: string };

/**
 * The gate every mutating server action runs first.
 *
 * Server actions are reachable by a direct POST, not just through the
 * dashboard, so the soft-lock screen in the dashboard layout protects nothing
 * on its own. This applies the same rule as that screen (an active, trialing
 * or past-due subscription) inside the action itself.
 *
 * Deliberately NOT used by billing actions (a lapsed company must be able to
 * subscribe again) or account deletion (anyone can always leave).
 */
export async function requireActiveCompany(): Promise<ActiveCompanyResult> {
  const company = await getCompany();
  if (!company) return { ok: false, reason: "no_session", error: SESSION_EXPIRED_MESSAGE };

  const entitlement = await getEntitlement(company.id);
  if (!entitlement.hasAccess) return { ok: false, reason: "no_access", error: NO_ACCESS_MESSAGE };

  const user = await getUser();
  return { ok: true, company, user };
}

/**
 * The same rule for the contractor upload link, where there's no signed-in
 * user: does the company behind this link have live access? Reads with the
 * service role, so the caller must already have resolved the company from a
 * valid token. A lookup error fails CLOSED here, unlike the anti-spam checks:
 * an upload against a company we can't confirm is paying is the thing being
 * prevented, and the contractor just sees "try again".
 */
export async function companyHasAccess(companyId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("status")
    .eq("company_id", companyId)
    .maybeSingle<{ status: SubscriptionStatus }>();
  if (error) {
    console.error("companyHasAccess: lookup failed", { code: error.code, message: error.message });
    return false;
  }
  return statusHasAccess(data?.status);
}
