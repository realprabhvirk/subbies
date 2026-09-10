/**
 * Normalizes an email address for account identity — signup, login, and
 * password reset should all compare emails through this, not the raw string
 * the user typed.
 *
 * Two things happen:
 *   1. The whole address is lowercased.
 *   2. For a fixed set of providers that treat `+tag` as a routable alias to
 *      the same inbox (Gmail and Outlook/Hotmail's family), everything from
 *      the first `+` to the `@` is stripped from the local part.
 *
 * Deliberately narrow. This does NOT:
 *   - strip `+tags` for any domain outside the fixed list — plenty of
 *     providers treat `+` as a literal character, not an alias marker, and
 *     stripping it there would silently merge two genuinely different inboxes
 *   - touch dot-handling (Gmail also ignores dots in the local part, e.g.
 *     `p.rabh@gmail.com` == `prabh@gmail.com`, but that's a separate, riskier
 *     rule not in scope here)
 *   - validate that the input is a well-formed email at all — the forms
 *     calling this already do that (`type="email" required`), and Supabase
 *     re-validates server-side regardless
 *
 * Safe to import from client components — no server-only dependencies.
 */

/** Domains where `local+tag@domain` and `local@domain` deliver to the same inbox. */
const ALIAS_TAG_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
]);

export function normalizeEmail(email: string): string {
  const lowered = email.trim().toLowerCase();

  const atIndex = lowered.indexOf("@");
  if (atIndex === -1) return lowered; // not shaped like an email — nothing more to do

  const local = lowered.slice(0, atIndex);
  const domain = lowered.slice(atIndex + 1);

  if (!ALIAS_TAG_DOMAINS.has(domain)) return `${local}@${domain}`;

  const plusIndex = local.indexOf("+");
  const strippedLocal = plusIndex === -1 ? local : local.slice(0, plusIndex);

  return `${strippedLocal}@${domain}`;
}
