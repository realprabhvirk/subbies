# Subbies upgrade: migrations

Claude never applies migrations to production. Mr Virk applies each file in the Supabase SQL editor, in order, then runs its verification query.

| # | File | Phase | Apply before |
|---|---|---|---|
| 0021 | `supabase/migrations/0021_plan_foundation_and_archiving.sql` | 1 | Merging Phase 1 |
| 0022 | `supabase/migrations/0022_project_workspace.sql` | 2 | Merging Phase 2 (after 0021) |
| 0023 | `supabase/migrations/0023_project_location_and_photos.sql` | 3 | Merging Phase 3 (after 0022) |

## 0021: plan foundation and contractor archiving

**What it does**

1. Adds `contractors.archived_at timestamptz null`, plus a partial index on live contractors.
2. `subbies_plan_limit`: Starter projects go from 0 to 1. Business and Pro are unchanged.
3. `subbies_assert_can_add`: counts only live contractors (`archived_at is null`) and open projects (`status <> 'completed'`), per D8.
4. New RPCs `archive_contractor(uuid)` and `restore_contractor(uuid)`. They're `security definer`, find the caller's company themselves, are granted to `authenticated` only, and restore re-checks the plan limit under the same lock as a create. `archived_at` is not in the column grant, so these RPCs are the only way to change it.
5. `assign_project_contractor` rejects archived contractors.
6. Trigger `projects_reopen_guard`: moving a project out of `completed` re-checks the project limit, so completing and reopening can't bypass it.

**Apply order:** after 0020 (Parts A and B). **Apply before merging Phase 1 to `main`**, because the Phase 1 code reads `archived_at`. It's safe to apply before the code ships: the deployed code never touches `archived_at`, and every limit change only loosens. One edge case: a Starter company that was downgraded and has completed projects can't reopen one past the new limit of 1. That's intended.

**Idempotent:** yes (`if not exists`, `create or replace`, `drop trigger if exists`). Tested twice in a row on a local Postgres 16 replica with 20 behaviour checks (limits, archive/restore, cross-company, anon, lapsed access, reopen guard).

**Verification query** (expect `1 | 3 | 1 | 1`):

```sql
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'contractors' and column_name = 'archived_at') as archived_col,
  (select count(*) from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('archive_contractor', 'restore_contractor', 'subbies_projects_reopen_guard')) as functions,
  (select count(*) from pg_trigger where tgname = 'projects_reopen_guard') as trigger,
  public.subbies_plan_limit('starter', 'projects') as starter_projects;
```

**Rollback** (only if needed; it puts back the 0020 behaviour and keeps the column so no data is lost):

```sql
drop trigger if exists projects_reopen_guard on public.projects;
drop function if exists public.subbies_projects_reopen_guard();
drop function if exists public.archive_contractor(uuid);
drop function if exists public.restore_contractor(uuid);
-- Then re-run the subbies_plan_limit, subbies_assert_can_add and
-- assign_project_contractor definitions from 0020 Part A.
-- Leave contractors.archived_at in place (dropping it would lose archive state).
```

## 0022: project workspace

**What it does**

1. Adds unique indexes on `(id, company_id)` for projects, document types and contractors. These are needed for the composite foreign keys.
2. `project_requirements`: which document types a project needs, whether each is mandatory, and an optional minimum number of days it must stay valid.
   - Composite FKs stop a row mixing companies.
   - A document type that's in use can't be deleted. The FK is NO ACTION, so deleting a whole company still cascades.
   - RLS allows company SELECT only.
3. `project_activity`: the append-only audit log.
   - Company SELECT only. No UPDATE or DELETE for anyone, including the service role.
   - Event types are checked.
   - A unique index makes `document_expired` once per project and document, so the daily job can re-run safely.
4. `project_contractor_status`: the last known status per project and contractor. It's server-only, with no client access at all.
5. `subbies_plan_has_feature` / `subbies_company_has_feature`. These hold the plan feature gates in SQL, between `PLAN_FEATURES_BEGIN/END` markers. A test checks them against `FEATURE_MIN_PLAN` in TypeScript.
6. Functions:
   - **Activity:** `record_project_activity` and `record_contractor_activity` for signed-in users. These refuse system-only event types. The `subbies_*` versions are service role only.
   - **Requirements:** `add_project_requirement` and `update_project_requirement` require Business or above. `remove_project_requirement` works on any plan, since removing only relaxes compliance.
   - **Status:** `sync_project_statuses`, plus `subbies_sync_project_statuses` for the service role. It records `compliance_status_changed` only on a real change. The first time a pair is seen it's stored silently, so no history is invented.

**Apply order:** after 0021. **Apply before merging Phase 2.**
- It's safe to apply before the code ships: it only adds things, and the deployed code never reads the new tables.
- If the Phase 2 code ships before 0022, it degrades rather than breaks. Activity and status writes become silent no-ops, and requirements read as empty (basic mode).

**Idempotent:** yes (`if not exists`, `create or replace`, `drop policy if exists`). Applied twice in a row on a local Postgres 16 replica. `supabase/tests/0022_project_workspace.sql` passes 40-plus checks, and the 0020 and 0021 tests still pass afterwards.

**Verification query** (expect `3 | 3 | 9 | true | false`):

```sql
select
  (select count(*) from information_schema.tables
    where table_schema = 'public'
      and table_name in ('project_requirements', 'project_activity', 'project_contractor_status')) as tables,
  (select count(*) from pg_indexes
    where schemaname = 'public'
      and indexname in ('projects_id_company_uniq', 'document_types_id_company_uniq', 'contractors_id_company_uniq')) as uniq_indexes,
  (select count(*) from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('subbies_plan_has_feature', 'subbies_company_has_feature', 'subbies_insert_project_activity',
                      'record_project_activity', 'subbies_record_contractor_activity', 'record_contractor_activity',
                      'add_project_requirement', 'update_project_requirement', 'remove_project_requirement')) as functions,
  public.subbies_plan_has_feature('business', 'requirements') as business_has_requirements,
  public.subbies_plan_has_feature('starter', 'requirements') as starter_has_requirements;
```

**Rollback** (drops Phase 2 data: requirements, activity and the status ledger; only if really needed):

```sql
drop function if exists public.sync_project_statuses(jsonb);
drop function if exists public.subbies_sync_project_statuses(uuid, jsonb, uuid);
drop function if exists public.subbies_status_label(text);
drop function if exists public.remove_project_requirement(uuid);
drop function if exists public.update_project_requirement(uuid, boolean, integer);
drop function if exists public.add_project_requirement(uuid, uuid, boolean, integer);
drop function if exists public.record_contractor_activity(uuid, text, text, uuid, jsonb);
drop function if exists public.subbies_record_contractor_activity(uuid, uuid, text, text, uuid, uuid, jsonb);
drop function if exists public.record_project_activity(uuid, text, text, uuid, uuid, jsonb);
drop function if exists public.subbies_insert_project_activity(uuid, uuid, text, text, uuid, uuid, uuid, jsonb);
drop function if exists public.subbies_company_has_feature(uuid, text);
drop function if exists public.subbies_plan_has_feature(text, text);
drop table if exists public.project_contractor_status;
drop table if exists public.project_activity;
drop table if exists public.project_requirements;
-- The three (id, company_id) unique indexes are harmless to keep.
```

## 0023: project location and jobsite photos

**What it does**

1. `projects` gets optional `location_address`, `latitude`, `longitude` (numeric 9,6), `location_place_id` and `location_is_manual`. Range checks, a both-or-neither check, and length checks are added via guarded `DO` blocks.
2. `set_project_location` / `clear_project_location`: the only way to write the location (the column grant is unchanged). Both record `location_changed`.
3. `project_photos`:
   - `unique (project_id, position)` (deferrable) with `position between 1 and 3`, so a 4th photo is refused by the database even when uploads race;
   - paths must sit under `{company_id}/{project_id}/`;
   - WebP only, 5 MB max;
   - RLS allows company SELECT only.
4. `add_project_photo` (lowest free slot, retries on a race), `replace_project_photo`, `delete_project_photo` (these two return the old paths) and `move_project_photo` (swaps in one statement). Each records its photo event.
5. A private `project-photos` bucket (5 MB, `image/webp`). Storage policies limit authenticated read, insert and delete to objects whose first folder is the caller's company id.

**Apply order:** after 0022. **Apply before merging Phase 3.**
- It's safe to apply before the code ships: everything is additive and the deployed code doesn't use any of it.
- If the Phase 3 code ships first, location and photos simply don't appear (separate queries that fail soft), and the sweep skips.

**Tests:**
- Applied twice in a row on the local Postgres 16 replica.
- `supabase/tests/0023_project_location_and_photos.sql` passes. It covers location validation, the 3-slot cap, move/replace/delete, cross-company access and the Storage policies.
- A real-parallel race (20 simultaneous uploads into an empty project) produced exactly slots 1, 2 and 3, and 17 refusals.

**Verification query** (expect `5 | 1 | 6 | false | 3`):

```sql
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'projects'
      and column_name in ('location_address', 'latitude', 'longitude', 'location_place_id', 'location_is_manual')) as location_cols,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'project_photos') as photos_table,
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
    and proname in ('set_project_location', 'clear_project_location', 'add_project_photo',
                    'replace_project_photo', 'delete_project_photo', 'move_project_photo')) as functions,
  (select public from storage.buckets where id = 'project-photos') as bucket_public,
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname like 'project photos own company%') as storage_policies;
```

**Rollback** (drops photos rows; delete the bucket's files in the dashboard first if you want them gone):

```sql
drop policy if exists "project photos own company read" on storage.objects;
drop policy if exists "project photos own company insert" on storage.objects;
drop policy if exists "project photos own company delete" on storage.objects;
drop function if exists public.move_project_photo(uuid, integer);
drop function if exists public.delete_project_photo(uuid);
drop function if exists public.replace_project_photo(uuid, text, text, text, integer);
drop function if exists public.add_project_photo(uuid, text, text, text, integer);
drop function if exists public.clear_project_location(uuid);
drop function if exists public.set_project_location(uuid, text, numeric, numeric, text, boolean);
drop table if exists public.project_photos;
-- The location columns are nullable and harmless to keep.
```
