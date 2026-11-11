# Subbies upgrade: progress

Start each session with: "Continue the Subbies upgrade from `docs/upgrade/PROGRESS.md`". Do the next unfinished phase fully, then stop and report.

## Status

| Phase | Branch | Status |
|---|---|---|
| 0 Audit | `feature/upgrade-p1-foundation` | Done. See `PLAN.md`. |
| 1 Foundation | `feature/upgrade-p1-foundation` | Done, pushed, not merged. **Apply migration 0021 before merging.** |
| 2 Project workspace | `feature/upgrade-p2-project-workspace` (branched from the Phase 1 branch, which isn't merged) | Done, pushed, not merged. **Apply 0021 then 0022 before merging.** Merge Phase 1 first, or merge this branch (it contains Phase 1). |
| 3 onwards | | Not started |

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

## Phase 2: what shipped

- **Compliance engine** (`lib/compliance/project.ts`):
  - A pure function with 15 table-driven tests.
  - Per requirement it returns valid, expiring, pending review, rejected, expired or missing, plus renewal-pending and `min_days_valid`.
  - Contractor status: cleared, expiring, pending review or not cleared.
  - Project percentage is null when nobody is assigned, never 0% or 100%.
  - Basic mode applies when there are no requirements, or the plan lacks them.
  - It reuses `EXPIRING_WINDOW_DAYS` and `complianceToday()`.
- **Loader** (`lib/projects/compliance-data.ts`): three queries whatever the contractor count.
  - Used by the workspace, the projects list, the dashboard's project count and the status sync.
  - Every compliance number comes from this one engine.
- **Activity:**
  - Recorded on all plans (D6) through one helper and the SQL functions.
  - Sources:
    - project created, updated and completed;
    - contractor assigned and removed;
    - requirement added and removed (sentences written in SQL);
    - document approved, replaced and rejected, fanned out to every project the contractor is on;
    - token uploads (service role, fanned out);
    - the daily job, for expiries in the last two days (idempotent, no backfill) and time-driven status changes. It runs inside the existing expiry cron, with no new cron entry.
- **Workspace** (`/dashboard/projects/[id]`): nested tabs Overview, Contractors, Requirements, Documents and Activity.
  - The layout awaits only the project row. The compliance figure streams in Suspense, every tab has its own `loading.tsx`, and loaders use `cache()`.
  - **Overview:** four stat tiles, then "Needs attention" (most urgent first, Request or Review), then recent activity.
  - **Contractors:** a per-project status pill and a requirement mini bar, plus assign and remove.
  - **Requirements (Business+):** mandatory/optional, minimum days valid, coverage, and add/remove with a confirm step.
  - **Documents register (Business+):** status chips with counts, `?status=` and `?page=` handled server-side, pages of 25, derived Missing rows with Request, a table on desktop and cards on mobile.
  - **Activity (Business+):** grouped by day, with cursor-based Load more.
  - Starter sees `UpgradePrompt` plus a plain description on the three gated tabs, and a lock icon on those tabs.
- **Request on a missing requirement** (`requestProjectDocument`):
  - Reuses the existing request flow (email, cooldown, daily cap).
  - Adds a `requested` row first if the contractor was never asked for that type.
  - Without a type (basic mode) it resends their onboarding request.
- Deleting a document type that projects require now says "Used by N projects".
- The Completed project pill is neutral, not green (lifecycle colour rule).
- `SHIPPED_FEATURES` now includes requirements, document register and activity, so they've left "Coming soon" on pricing.

## Decisions

- D1–D11 locked as per the brief.
- Archiving needs an active subscription in the server action (same gate as every dashboard write). The SQL RPC itself allows archiving without access, since it only reduces usage.
- Archived contractors keep their project assignments, which are hidden rather than removed, so restore brings them back.
- Approve and reject still work on an archived contractor's already-uploaded documents. That's reviewing records, not contacting them.
- Upgrade prompts for gated features list the feature plus real limit lines, never other gated features (which may not have shipped).

- (P2) Requirements count only on plans that include them. A downgraded company keeps its requirements (D7), sees basic mode, and they apply again on upgrade.
- (P2) "Reviewed" in the register is the last update of an approved or rejected document. There's no separate reviewed-at column.
- (P2) Optional requirements show in the register and on the bar, but a missing optional one isn't a "needs attention" item. An expiring one is.
- (P2) The client can write its own company's activity (single-owner company). System-only event types (`document_expired`, `compliance_status_changed`) are refused from the client.

## Deviations from the brief

- Plan config stays in `lib/billing/plans.ts` (already imported across the app). `lib/plans.ts` re-exports it.
- D8 says "archived/completed projects". Projects have no archive state, so only `completed` is excluded.
- The brief asked to fix a `/pricing` mobile overflow. It measured 0px before and after, so the change is hardening rather than a fix.
- `supabase/tests/0020_security_audit_fixes.sql` was adjusted so its Starter-projects checks pass both before and after 0021.

- (P2) The document type FK is NO ACTION, not RESTRICT. A direct delete is refused the same way, but deleting a whole company still cascades.
- (P2) Location and photos cards and the "Download PDF" button are left out of the overview until Phases 3 and 4, to avoid dead controls. The right rail currently holds recent activity.
- (P2) There's no project archive state, so `project_archived` is in the event list but never written.
- (P2) "Request" for a missing document reuses the existing email path through a small new action, because there was no flow for requesting a new document type from an existing contractor.

## UNVERIFIED

- 0021 has been tested on a local Postgres 16 replica built from the repo migrations (both SQL test files pass, before and after), **not on the real Supabase project**. Run the verification query after applying.
- Screens were checked against a mock Supabase, not a live account: pricing, contractors (limit plus archived filter), archived contractor, archive dialog, projects, and the inactive upload link.
- The archive/restore round trip through a real browser and real Supabase is unverified. It's covered by unit tests against the fake and by SQL tests.
- The billing settings usage tiles in the new navy tone weren't screenshotted.
- (P2) 0022 was tested on the local replica only, not real Supabase.
- (P2) Workspace screens were checked against a mock: overview, contractors, requirements and documents at 1440px; overview and documents at 390px; the Starter locked state; 0 px overflow everywhere.
- (P2) Not exercised end to end: Request, add/remove requirement, Load more, the cron project job, and token upload fan-out. The SQL functions are covered by SQL tests and the engine and register by unit tests.

## Env vars

No new env vars in Phase 1 or Phase 2.

## New dependencies

None.

## Migrations

See `MIGRATIONS.md`. None applied to production by Claude.

- 2026-11-11: Mr Virk reports 0021 and 0022 applied in the Supabase SQL editor. Verification query output not shared yet.

## Founder decisions to confirm

- D8: only completed projects are excluded from the project limit (there's no project archive). Confirm, or ask for a project archive in a later phase.
- D9: Pro seat cap of 10 is in config. Nothing enforces it until the team phase.
- D10: priority support is listed as "Coming soon" on Pro until the `[Priority]` route ships.
- D11: Manager role sees all projects. Nothing to do until the team phase.
- Starter now includes 1 project. Existing Starter customers gain it on deploy.
