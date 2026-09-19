/**
 * The decisions the signup page makes after `supabase.auth.signUp()` returns,
 * as pure functions so they can be tested under plain `node --test`.
 *
 * Why this exists: the signup page used to create the `companies` row itself,
 * right after signUp, through the RLS-scoped browser client. That only works
 * when signUp hands back a *session* — which it does today solely because
 * email confirmation is switched off in the Supabase dashboard. Turn
 * confirmation on (or hit any case where Supabase returns a user without a
 * session) and the insert runs unauthenticated, RLS refuses it, and the
 * person is left with a login that isn't linked to any company. The
 * dashboard's recovery screen then told them to "sign up again", which fails
 * with "already registered". A dead end, reached by a config toggle.
 *
 * The fix is in three parts: classify the signUp result honestly (below),
 * carry the company name in the user's metadata so it survives to the first
 * authenticated visit, and let the dashboard finish setup for any account
 * that has a login but no company — whether it got that way via confirmation
 * being on, a transient insert failure, or history. Signup no longer depends
 * on whether confirmation is on or off; it behaves correctly either way.
 */

export type SignupOutcome =
  /** Supabase reported the email is already taken (explicit error, or its anti-enumeration "empty identities" shape). */
  | "already_registered"
  /** A user AND a session came back: confirmation is off, the company row can be created right now. */
  | "session_ready"
  /** A user but no session: confirmation is on; they must click the email link, then log in. */
  | "confirmation_pending"
  /** No user and no error — shouldn't happen, treated as a failure. */
  | "no_user";

export function classifySignupResult(input: {
  user: { identities?: unknown[] | null } | null;
  session: unknown | null;
}): SignupOutcome {
  if (!input.user) return "no_user";
  // Supabase's anti-enumeration behaviour for an already-registered email:
  // a 200 with a user object whose identities array is empty and no session.
  if (Array.isArray(input.user.identities) && input.user.identities.length === 0) {
    return "already_registered";
  }
  return input.session ? "session_ready" : "confirmation_pending";
}

export const MAX_COMPANY_NAME = 120;

/**
 * The company name to prefill from `user_metadata.company_name`, or null if
 * there's nothing usable there. Never trusted blindly: it's still submitted
 * through a form and validated server-side before it becomes a row.
 */
export function companyNameFromMetadata(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_COMPANY_NAME);
}
