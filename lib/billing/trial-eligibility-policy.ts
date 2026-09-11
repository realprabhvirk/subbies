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
