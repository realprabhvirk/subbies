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

/**
 * TEMP: testing exception, remove before production launch.
 *
 * Base addresses (lowercased) exempt from +tag stripping, so their owner can
 * create multiple real Supabase accounts for manual QA — pvirk0+1@outlook.com,
 * pvirk0+2@outlook.com, etc. — each a genuinely distinct account.
 *
 * Matched by EXACT string equality against the tag-stripped address, never a
 * prefix or substring check. That's the property that keeps this from being
 * a spoofing hole: pvirk00@outlook.com and xpvirk0@outlook.com strip to
 * "pvirk00@outlook.com" / "xpvirk0@outlook.com", neither of which equals
 * "pvirk0@outlook.com", so neither matches — they get normalized like anyone
 * else's address. This set also grants no access by itself; it only decides
 * whether two literal strings collapse into one account before Supabase's
 * own uniqueness constraint sees them.
 */
const NORMALIZATION_EXEMPT_BASE_EMAILS = new Set([
  "pvirk0@outlook.com", // TEMP: testing exception, remove before production launch
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
  const wouldNormalizeTo = `${strippedLocal}@${domain}`;

  // TEMP: testing exception, remove before production launch — see
  // NORMALIZATION_EXEMPT_BASE_EMAILS above. Return the lowercased/trimmed
  // input as-is, tag intact, instead of the stripped form.
  if (NORMALIZATION_EXEMPT_BASE_EMAILS.has(wouldNormalizeTo)) {
    return lowered;
  }

  return wouldNormalizeTo;
}
