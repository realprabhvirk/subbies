/**
 * Pure trial-grant decision — no database, no "server-only".
 *
 * Split out of lib/billing/trial-eligibility.ts specifically so it can be
 * unit tested with plain `node --test`: that file imports "server-only" (it
 * touches the service-role client), and "server-only" only resolves inside
 * Next.js's own webpack build — it throws MODULE_NOT_FOUND under a bare Node
 * process, which is how the test runner executes this repo's tests.
 */
export function shouldSkipTrial(input: {
  /** This company has held a real subscription before (cancel + resubscribe loop). */
  hadSubscriptionBefore: boolean;
  /** This normalized email already consumed a trial on a now-deleted account. */
  emailUsedTrialBefore: boolean;
}): boolean {
  return input.hadSubscriptionBefore || input.emailUsedTrialBefore;
}

/**
 * What a `used_trial_emails` lookup means for trial eligibility — including
 * the case where the lookup itself failed.
 *
 * Fails OPEN on a failed lookup, and that direction is the whole point of
 * this function existing separately.
 *
 * The first version of this failed CLOSED — a lookup error was treated as
 * "assume they've had a trial" — on the reasoning that we shouldn't hand out
 * a trial we can't verify is owed. That reasoning was wrong, because the two
 * directions have wildly different blast radii:
 *
 *   - Fail closed, and ANY breakage of the ledger (table missing, schema
 *     cache cold, Postgres blip) silently denies the trial to 100% of new
 *     signups. Which is exactly what happened: migration 0009 hadn't been
 *     run, every lookup returned PGRST205, and every brand-new customer was
 *     quietly charged on day one instead of getting their 7 days.
 *   - Fail open, and the worst case is that during an outage a
 *     deleted-then-re-signed-up email gets a second trial — a narrow abuse
 *     case, and precisely the behaviour the product had before this ledger
 *     existed at all.
 *
 * An unavailable anti-abuse check should degrade to the pre-existing
 * behaviour, never to a worse experience for every legitimate customer.
 */
export function emailUsedTrialFromLookup(lookup: {
  /** A matching row was found in used_trial_emails. */
  found: boolean;
  /** The query itself errored, so `found` carries no information. */
  lookupFailed: boolean;
}): boolean {
  if (lookup.lookupFailed) return false;
  return lookup.found;
}
