# Subbies upgrade: Phase 0 audit

Read-only audit of `main` at `0b452e3` (2026-11-11), done before any Phase 1 code. Where the brief and the repo differ, the repo wins and the difference is listed under "Conflicts and resolutions".

## Stack

- Next.js 16.4.6 (App Router, `proxy.ts` instead of middleware), React 19.2.8, Tailwind v4 (single `@theme` in `app/globals.css`).
- `app/` and `lib/` at the repo root. No `src/`.
- Runtime deps: `@supabase/ssr`, `@supabase/supabase-js`, `lucide-react`, `next`, `react`, `react-dom`, `resend`, `stripe`. No zod, no sharp, no CSV parser, no chart, map or PDF library yet.
- Tests: `node --test` over `lib/**/*.test.ts` (368 passing at audit time). Server-module stubs in `lib/test-support/server-module-stubs.ts`, in-memory Supabase fake in `lib/test-support/fake-supabase.ts`.
- Crons (`vercel.json`): `/api/cron/trial-reminders` 09:00 UTC, `/api/cron/expiry-reminders` 21:00 UTC. `/api/cron/orphan-uploads` exists as a route.

## Premium UI

Merged to `main`. Use its primitives for all new UI: `PageHeader`, `SectionCard`, `StatTile`, `ListRow`/`RowList`, `ActionTile`, `IconDisc`, `DonutChart`, `StatusBadge`, `EmptyState`, `Skeleton`, `IconButton`, `Dialog`/`ConfirmDialog`, `Alert`, `Button`/`ButtonLink`, `Chip`. Tokens: `tile-*` colours, `text-card-title`/`page-title`/`hero`/`stat`, `rounded-card` (20px), `--page-padding`.

## Schema

Migrations live in `supabase/migrations/NNNN_snake_case.sql`, 0001 to 0020. **Next number: 0021.**

| Table | Notes |
|---|---|
| `companies` | One per user (`user_id`). No membership table yet (D5 adds `company_members`). |
| `subscriptions` | One per company. `plan` (`starter`/`business`/`pro`), `status` (`none`, `trialing`, `active`, `past_due`, `canceled`, `unpaid`, ...), Stripe ids, `trial_end`, `onboarding_completed_at`. |
| `contractors` | `status` (`pending`, `awaiting_review`, `approved`, `attention_required`, ...), `abn`. **No `archived_at` yet.** |
| `contractor_tokens` | Upload link token per contractor, `expires_at`. Fully revoked from `anon`/`authenticated`. |
| `contractor_documents` | `status` (`requested`, `uploaded`, `approved`, `rejected`, `revoked`), `expiry_date`, `archived_at` (history), `replaces_document_id` (pending replacement). |
| `contractor_document_files` | Multiple files per document (0011). Path ownership trigger (0016). |
| `contractor_notes` | Notes per contractor (0015). |
| `document_types` | Per company, `default_duration_months`, `reminder_days`. |
| `projects` | `name`, `address text` (free text, no lat/lng), `status` (`active`/`on_hold`/`completed`), `start_date`, `end_date`. |
| `project_contractors` | Assignment, soft remove via `removed_at`. Unique active pair. |
| `expiry_reminder_log`, `email_send_log`, `contractor_request_cooldowns`, `rate_limit_hits`, `trial_card_fingerprints` | Server-only bookkeeping. |

Storage: one private bucket `contractor-documents` (15 MB, PDF/JPEG/PNG/HEIC). Access is by short-lived signed URL only.

## RLS and write path

- Read policies: `company_id in (select id from public.companies where user_id = auth.uid())`, and child tables join through `contractors`/`projects`.
- Since 0020 Part B, signed-in users **cannot insert** into `contractors`, `document_types`, `projects`, `project_contractors`. Creates go through `SECURITY DEFINER` RPCs (`create_contractor`, `create_document_type`, `create_project`, `assign_project_contractor`) that resolve the caller's company themselves.
- Updates are column-limited: contractors `(business_name, contact_name, email, phone, trade, abn, status)`, projects `(name, address, status, start_date, end_date)`, document_types `(name, default_duration_months, reminder_days)`, project_contractors `(role_on_project, removed_at)`.
- Helper functions (all `security definer`, `search_path = ''`, revoked from client roles): `subbies_company_has_access` (`ACCESS_STATUSES` marker), `subbies_plan_limit` (`PLAN_LIMITS_BEGIN/END` markers), `subbies_caller_company`, `subbies_assert_can_add` (advisory lock per company, so parallel creates can't both take the last slot).
- `lib/billing/plan-limits-sql.test.ts` fails if the SQL limits drift from TypeScript.

## Billing and entitlements

- Plan config: `lib/billing/plans.ts` (`PLANS`, `PLAN_IDS`, `TRIAL_DAYS = 7`, `priceIdForPlan`, `planForPriceId`). Prices A$19/39/79. Price ids come from `STRIPE_PRICE_STARTER/BUSINESS/PRO`.
- Current limits: Starter 5 contractors / 7 doc types / **0 projects**; Business 25/15/10; Pro unlimited.
- Entitlement: `lib/billing/entitlements.ts` (`getEntitlement`, `checkResourceLimit`, `canAddContractor/DocumentType/Project`, `limitMessage`, `getUsageCounts`). `countResource` counts **every** row for the company.
- Access: trialing, active and past_due have access (`lib/billing/access-statuses.ts`). Lapsed accounts are soft-locked, not deleted.
- Enforcement points: TS pre-check in each create action (friendly message), then the SQL RPC (authoritative, race-safe). Pages call `canAdd*` to swap the "Add" button.
- Webhook: `app/api/webhooks/stripe/route.ts` handles `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `trial_will_end`, `invoice.payment_failed`, synced through `lib/billing/sync.ts`. One trial per card (`lib/billing/trial-card.ts`).
- Copy that renders plans: `/pricing`, landing page (`app/(marketing)/page.tsx`), `/onboarding` plan selection, settings billing panel (`PlanCards`), trial and webhook emails. All read `PLANS`. No hardcoded price or limit literals found outside `plans.ts` and migration 0020.
- Unmeasured claims: `/pricing` has a "Document storage" row ("Unlimited" on Pro, "Fair use" otherwise) and a fair-use footnote. `storageMarketing` exists in config but nothing measures storage.

## Contractors, reminders and token routes

- No archive. Only hard delete (with files) from the detail page `ConfirmDialog`.
- Lists: `app/dashboard/contractors/page.tsx` (filter chips via `lib/contractor-filter.ts`, buckets via `lib/dashboard-buckets.ts`), dashboard tiles (`app/dashboard/page.tsx`), project detail assigned list, contractor picker in `app/dashboard/projects/actions.ts`.
- Expiry reminders: `app/api/cron/expiry-reminders/route.ts` loads companies with access, then **all** their contractors, then approved documents nearing expiry.
- Token routes: `/onboard/[token]`. `lib/onboarding.ts` (`lookupToken`, `resolveOnboardingToken`, `getOnboardingContext`) validates the UUID and expiry, then uses the service-role client because there is no signed-in user. Unknown or expired tokens render `not-found.tsx`. There's an existing missing-column fallback pattern for deploys that land before a migration.

## Projects

- Pages: `/dashboard/projects`, `/dashboard/projects/[id]`, create and edit via actions. Status values `active`, `on_hold`, `completed`. Address is a single text field (no geocode), relevant for the Mapbox phase.
- Compliance per project: `lib/projects.ts` (`hasComplianceIssue`, `projectIssueCount`) over assigned contractors' status.

## Notes for later phases

- **Map (D1 Mapbox):** needs geocoding of `projects.address` into new nullable `lat`/`lng` columns, geocoded server-side on save, with the token server-only for geocoding and a URL-restricted public token for tiles. Mapbox bills per map load and geocode request, so geocode once on save, never per page view.
- **Photos (D3):** new private bucket, server-side processing with `sharp` (new dependency, to be justified then). Cap originals and strip EXIF location unless the feature needs it. Storage grows per photo, so the max of 3 per item keeps it bounded.
- **PDF (D2):** `@react-pdf/renderer` is a new dependency for that phase. Render server-side only.
- **Team (D5):** `company_members` changes every RLS policy that uses `companies.user_id = auth.uid()`. That's the riskiest migration in the programme and needs its own phase with a compatibility period.

## Conflicts and resolutions

| Brief says | Repo has | Resolution |
|---|---|---|
| `lib/plans.ts` holds `PLAN_CONFIG` | `lib/billing/plans.ts` holds `PLANS`, imported in ~15 places | Extend `lib/billing/plans.ts` (adds `PLAN_CONFIG`, `limitFor`, `can`, typed errors). `lib/plans.ts` re-exports it so both paths work. |
| Archived/completed projects don't count (D8) | Projects have no archive state | Only `completed` projects are excluded. A trigger stops a completed project being reopened past the limit. |
| Starter: 1 project | Starter: 0 projects (TS and SQL) | Changed to 1 in both, via migration 0021. |
| Next migration is 0021 | Confirmed | Phase 1 adds `0021_plan_foundation_and_archiving.sql`. |
| Fix `/pricing` mobile overflow | The premium UI sweep measured 0px overflow at 390px | Re-measured in Phase 1, and the hardening is applied anyway (see PROGRESS.md). |
