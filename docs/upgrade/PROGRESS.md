# Subbies upgrade: progress

Start each session with: "Continue the Subbies upgrade from `docs/upgrade/PROGRESS.md`". Do the next unfinished phase fully, then stop and report.

## Status

| Phase | Branch | Status |
|---|---|---|
| 0 Audit | `feature/upgrade-p1-foundation` | Done. See `PLAN.md`. |
| 1 Foundation | `feature/upgrade-p1-foundation` | Done, pushed, not merged. **Apply migration 0021 before merging.** |
| 2 onwards | | Not started |

## Before merging Phase 1

1. Apply `supabase/migrations/0021_plan_foundation_and_archiving.sql` in the Supabase SQL editor (see `MIGRATIONS.md`).
2. Run the verification query. Expect `1 | 3 | 1 | 1`.
3. Optional: run `supabase/tests/0021_plan_foundation_and_archiving.sql` on staging. It rolls itself back.
4. Merge the branch. Vercel deploys `main`.

The code reads `contractors.archived_at`. Without 0021, the dashboard and contractor lists would error. The public upload link falls back safely either way.

## Phase 1: what shipped

- **Plan config** (`lib/billing/plans.ts`, re-exported from `lib/plans.ts`):
  - `PLAN_CONFIG` holds price, price env name, limits, seats, photos, tag, `features` and `comingSoon`.
  - Helpers: `limitFor(plan, resource)`, `can(plan, feature)`, `checkLimit(...)`, `planToAdd(...)` and `featureError(...)`.
  - Typed `PlanError` (`PLAN_LIMIT` / `PLAN_FEATURE`). Feature gates live in `FEATURE_MIN_PLAN`, shipped features in `SHIPPED_FEATURES`.
  - Feature-list limit lines are generated from the limits, so no limit literal exists outside the config and migrations.
- **Limits:**
  - Starter projects go from 0 to 1. Business 25/15/10 and Pro unlimited are unchanged (verified).
  - Archived contractors and completed projects don't count (D8), in both TS (`countResource`) and SQL (`subbies_assert_can_add`).
  - Reopening a completed project re-checks the limit (trigger).
- **Contractor archiving:**
  - `archived_at` column, plus `archive_contractor`/`restore_contractor` RPCs. Restore re-checks the limit and returns a typed error with an upgrade prompt.
  - Archived contractors are excluded from:
    - the register (with a new "Archived" filter);
    - dashboard tiles;
    - project assigned/compliance counts (a project page notes how many are hidden);
    - the assign picker;
    - expiry reminders;
    - request emails.
  - The upload link shows "This link is no longer active" and refuses uploads.
  - The confirm dialog says exactly what happens. Nothing is deleted.
- **UpgradePrompt** (`app/components/upgrade-prompt.tsx`):
  - variants `inline`, `limit` and `dialog`;
  - navy-tinted lock disc;
  - title names the feature or limit, then one sentence on why it's unavailable, then 3 bullets;
  - plan and price from config, "Upgrade to X" linking to settings billing, and "Compare plans" linking to `/pricing`;
  - rendered only from `limitCheck.planError`, with one per page.
  - Used on contractors, add contractor, projects, document types and archived-contractor restore.
- **Copy:**
  - Pricing loses the "Document storage" row and the fair-use footnote.
  - The tag "Best for growing builders" and the CTA "Start your 7-day free trial" come from config.
  - Unshipped features are shown only as "Coming soon", on pricing, onboarding and billing plan cards.
  - Check marks and usage tiles move from green/amber to navy (colour rule). StatTile gains a `brand` tone. LimitBanner (lapsed access only) moves off amber.
- **Pricing mobile:** the table sits in `overflow-x-auto` with `min-w-0 max-w-full`. The rate card and marketing `Section` are hardened too. Measured 0px horizontal overflow at 390px and 1440px.

## Decisions

- D1–D11 locked as per the brief.
- Archiving needs an active subscription in the server action (same gate as every dashboard write). The SQL RPC itself allows archiving without access, since it only reduces usage.
- Archived contractors keep their project assignments, which are hidden rather than removed, so restore brings them back.
- Approve and reject still work on an archived contractor's already-uploaded documents. That's reviewing records, not contacting them.
- Upgrade prompts for gated features list the feature plus real limit lines, never other gated features (which may not have shipped).

## Deviations from the brief

- Plan config stays in `lib/billing/plans.ts` (already imported across the app). `lib/plans.ts` re-exports it.
- D8 says "archived/completed projects". Projects have no archive state, so only `completed` is excluded.
- The brief asked to fix a `/pricing` mobile overflow. It measured 0px before and after, so the change is hardening rather than a fix.
- `supabase/tests/0020_security_audit_fixes.sql` was adjusted so its Starter-projects checks pass both before and after 0021.

## UNVERIFIED

- 0021 has been tested on a local Postgres 16 replica built from the repo migrations (both SQL test files pass, before and after), **not on the real Supabase project**. Run the verification query after applying.
- Screens were checked against a mock Supabase, not a live account: pricing, contractors (limit plus archived filter), archived contractor, archive dialog, projects, and the inactive upload link.
- The archive/restore round trip through a real browser and real Supabase is unverified. It's covered by unit tests against the fake and by SQL tests.
- The billing settings usage tiles in the new navy tone weren't screenshotted.

## Env vars

No new env vars in Phase 1.

## New dependencies

None.

## Migrations

See `MIGRATIONS.md`. None applied to production by Claude.

## Founder decisions to confirm

- D8: only completed projects are excluded from the project limit (there's no project archive). Confirm, or ask for a project archive in a later phase.
- D9: Pro seat cap of 10 is in config. Nothing enforces it until the team phase.
- D10: priority support is listed as "Coming soon" on Pro until the `[Priority]` route ships.
- D11: Manager role sees all projects. Nothing to do until the team phase.
- Starter now includes 1 project. Existing Starter customers gain it on deploy.
