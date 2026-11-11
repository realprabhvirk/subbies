# Subbies upgrade: progress

Start each session with: "Continue the Subbies upgrade from `docs/upgrade/PROGRESS.md`". Do the next unfinished phase fully, then stop and report.

## Status

| Phase | Branch | Status |
|---|---|---|
| 0 Audit | `feature/upgrade-p1-foundation` | Done. See `PLAN.md`. |
| 1 Foundation | `feature/upgrade-p1-foundation` | In progress |

## Decisions

- D1–D11 locked as per the brief.

## Deviations from the brief

- Plan config stays in `lib/billing/plans.ts` (already imported across the app). `lib/plans.ts` re-exports it.

## UNVERIFIED

(Items that couldn't be tested locally go here.)

## Env vars

No new env vars in Phase 1.

## Migrations

See `MIGRATIONS.md`. None applied to production by Claude.
