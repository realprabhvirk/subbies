/**
 * Decides whether a `redirectTo` value read from the URL is safe to send the
 * browser to after login.
 *
 * The login page used to pass `?redirectTo=` straight into router.replace().
 * The only thing that ever *writes* that parameter is the middleware, and it
 * writes a pathname — but nothing checked that on the way back in, so
 * `/login?redirectTo=https://evil.example` would, after a real login, hand
 * the freshly signed-in user to another site. That's an open redirect: the
 * classic phishing shape is a link that really does go to subbies, really
 * does log the person in, and then lands them somewhere that looks like
 * subbies and asks for their password "again".
 *
 * Only a same-origin absolute path is allowed through: starts with exactly
 * one "/", not "//" (protocol-relative — the browser reads that as a host)
 * and not "/\" (which browsers normalise to "//"). Anything else falls back.
 *
 * Pure and dependency-free so it can be tested under plain `node --test`.
 */
const SAFE_PATH = /^\/(?![/\\])\S*$/;

export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!candidate) return fallback;
  return SAFE_PATH.test(candidate) ? candidate : fallback;
}
