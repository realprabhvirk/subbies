import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Company, Subscription } from "@/lib/types";

/**
 * Data Access Layer.
 *
 * Every server-side read of user-scoped data should start here so the auth
 * check can't be forgotten. `cache` dedupes the work within a single render.
 */

/** The verified identity of the signed-in user. */
export interface AuthUser {
  id: string;
  email: string | null;
}

/**
 * The signed-in user, or null.
 *
 * Uses `getClaims()` rather than `getUser()`: with asymmetric JWT signing keys
 * this verifies the token's signature locally through WebCrypto against a
 * cached JWKS, so it costs no network round trip. That is a real cryptographic
 * verification — unlike `getSession()`, which decodes without verifying and
 * must never be trusted on the server. On a project still using a symmetric
 * JWT secret it transparently falls back to a server call, i.e. exactly the
 * old behaviour, so this is never slower than what it replaced.
 *
 * Trade-off: local verification trusts the token until it expires, so a
 * server-side session revocation isn't noticed until then (default 1 hour).
 * Sign-out clears the cookie outright and so is unaffected, and this app has
 * no admin session-revocation flow, so in practice the window is unreachable.
 */
export const getUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return null;

  const claims = data.claims;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});

export const requireUser = cache(async (): Promise<AuthUser> => {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
});

export interface CompanyContext {
  company: Company;
  /** null when the company has no subscription row yet. */
  subscription: Subscription | null;
}

interface CompanyRow extends Company {
  /** PostgREST embeds a one-to-one relation as an object, but tolerate an array. */
  subscriptions: Subscription | Subscription[] | null;
}

/**
 * The signed-in user's company and its subscription, in a single round trip.
 *
 * These used to be two sequential queries (company, then subscription keyed by
 * the company id it returned), which put two serial network hops in front of
 * every dashboard render. `subscriptions.company_id` is a unique FK onto
 * `companies`, so PostgREST can embed the row directly and RLS still applies
 * to both tables exactly as before.
 */
export const getCompanyContext = cache(
  async (): Promise<CompanyContext | null> => {
    const user = await requireUser();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("companies")
      .select(
        "id, user_id, name, address, phone, created_at, subscriptions(*)",
      )
      .eq("user_id", user.id)
      .maybeSingle<CompanyRow>();

    if (error) {
      // A failure to resolve the embed (PGRST200) would otherwise make every
      // dashboard page think the account has no company at all. Fall back to
      // the two-query form so a schema-cache hiccup costs latency, not access.
      console.error("Company+subscription embed failed, falling back", error);
      return loadCompanyContextSeparately(user.id);
    }
    if (!data) return null;

    const { subscriptions, ...company } = data;
    const subscription = Array.isArray(subscriptions)
      ? (subscriptions[0] ?? null)
      : (subscriptions ?? null);

    return { company, subscription };
  },
);

/** The pre-embed path: company and subscription as two sequential queries. */
async function loadCompanyContextSeparately(
  userId: string,
): Promise<CompanyContext | null> {
  const supabase = await createClient();

  const { data: company, error } = await supabase
    .from("companies")
    .select("id, user_id, name, address, phone, created_at")
    .eq("user_id", userId)
    .maybeSingle<Company>();

  if (error) {
    console.error("Failed to load company", error);
    return null;
  }
  if (!company) return null;

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("company_id", company.id)
    .maybeSingle<Subscription>();

  return { company, subscription: subscription ?? null };
}

/**
 * The company row for the signed-in user. Returns null if the auth user has
 * no company record yet (a broken signup) so the caller can show a recovery
 * state instead of looping through /login.
 */
export const getCompany = cache(async (): Promise<Company | null> => {
  const context = await getCompanyContext();
  return context?.company ?? null;
});
