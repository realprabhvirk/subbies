# Subbies upgrade: migrations

Claude never applies migrations to production. Mr Virk applies each file in the Supabase SQL editor, in order, then runs its verification query.

| # | File | Phase | Apply before |
|---|---|---|---|
| 0021 | `supabase/migrations/0021_plan_foundation_and_archiving.sql` | 1 | Merging Phase 1 |

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
