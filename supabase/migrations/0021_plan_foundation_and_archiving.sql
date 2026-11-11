-- 0021: plan foundation and contractor archiving (upgrade Phase 1)
--
-- Additive and idempotent. Safe to apply before the Phase 1 code ships: the
-- currently deployed code never reads or writes archived_at, the limit
-- changes only loosen (Starter gets 1 project, archived contractors and
-- completed projects stop counting), and no archived contractors exist until
-- the new code archives one.
--
-- 1. contractors.archived_at (nullable) plus an index for the live list.
-- 2. subbies_plan_limit: Starter projects 0 -> 1.
-- 3. subbies_assert_can_add: counts live contractors and open projects only.
-- 4. archive_contractor / restore_contractor RPCs (restore re-checks the limit).
-- 5. assign_project_contractor rejects archived contractors.
-- 6. Reopening a completed project re-checks the project limit.
--
-- Rollback: see docs/upgrade/MIGRATIONS.md.


-- 1. Archive column -------------------------------------------------------------
alter table public.contractors
  add column if not exists archived_at timestamptz;

comment on column public.contractors.archived_at is
  'Set when the company archives the contractor. Archived contractors keep all their data, are excluded from plan limits, lists, reminders and project counts, and can be restored.';

create index if not exists contractors_company_live_idx
  on public.contractors (company_id)
  where archived_at is null;


-- 2. Plan limits ----------------------------------------------------------------
-- A plan's limit for one resource. NULL = unlimited, 0 = not included.
-- An unknown plan (or no plan) gets 0.
create or replace function public.subbies_plan_limit(p_plan text, p_resource text)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  found_limit integer;
begin
  select l.lim into found_limit
    from (values
      -- PLAN_LIMITS_BEGIN (must match lib/billing/plans.ts)
      ('starter',  'contractors',    5),
      ('starter',  'document_types', 7),
      ('starter',  'projects',       1),
      ('business', 'contractors',    25),
      ('business', 'document_types', 15),
      ('business', 'projects',       10),
      ('pro',      'contractors',    null::integer),
      ('pro',      'document_types', null::integer),
      ('pro',      'projects',       null::integer)
      -- PLAN_LIMITS_END
    ) as l(plan, resource, lim)
   where l.plan = p_plan and l.resource = p_resource;
  if not found then
    return 0;
  end if;
  return found_limit;
end;
$$;


-- 3. Limit check ----------------------------------------------------------------
-- Same as 0020, except archived contractors and completed projects don't
-- count (D8). Must match countResource in lib/billing/entitlements.ts.
create or replace function public.subbies_assert_can_add(p_company_id uuid, p_resource text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_name text;
  lim integer;
  used integer;
begin
  perform pg_advisory_xact_lock(hashtext('subbies-limit:' || p_company_id::text));

  if not public.subbies_company_has_access(p_company_id) then
    raise exception 'SUBBIES_NO_ACCESS' using errcode = 'P0001';
  end if;

  select s.plan into plan_name from public.subscriptions s where s.company_id = p_company_id;
  lim := public.subbies_plan_limit(plan_name, p_resource);
  if lim is null then
    return;
  end if;

  if p_resource = 'contractors' then
    select count(*) into used from public.contractors
     where company_id = p_company_id and archived_at is null;
  elsif p_resource = 'document_types' then
    select count(*) into used from public.document_types where company_id = p_company_id;
  elsif p_resource = 'projects' then
    select count(*) into used from public.projects
     where company_id = p_company_id and status <> 'completed';
  else
    raise exception 'unknown resource %', p_resource;
  end if;

  if used >= lim then
    raise exception 'SUBBIES_LIMIT_REACHED' using errcode = 'P0001';
  end if;
end;
$$;


-- 4. Archive and restore --------------------------------------------------------
-- archived_at is not in the contractors column grant, so these are the only
-- way a signed-in user can change it. Archiving needs no live subscription
-- (it only reduces usage). Restoring counts as adding a contractor, so it
-- takes the same lock and limit check as create_contractor.
create or replace function public.archive_contractor(p_contractor_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid := public.subbies_caller_company();
  stamped timestamptz;
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;

  update public.contractors c
     set archived_at = coalesce(c.archived_at, now())
   where c.id = p_contractor_id
     and c.company_id = company
  returning c.archived_at into stamped;

  if stamped is null then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;
  return stamped;
end;
$$;

create or replace function public.restore_contractor(p_contractor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid := public.subbies_caller_company();
  was_archived timestamptz;
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;

  select c.archived_at into was_archived
    from public.contractors c
   where c.id = p_contractor_id and c.company_id = company;
  if not found then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;
  if was_archived is null then
    return; -- already live
  end if;

  -- Counts live contractors only, so the one being restored isn't counted yet.
  perform public.subbies_assert_can_add(company, 'contractors');

  update public.contractors c
     set archived_at = null
   where c.id = p_contractor_id and c.company_id = company;
end;
$$;


-- 5. Assignment rejects archived contractors ------------------------------------
create or replace function public.assign_project_contractor(
  p_project_id uuid,
  p_contractor_id uuid,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid := public.subbies_caller_company();
  new_id uuid;
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;
  if not public.subbies_company_has_access(company) then
    raise exception 'SUBBIES_NO_ACCESS' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.projects p where p.id = p_project_id and p.company_id = company)
     or not exists (
       select 1 from public.contractors c
        where c.id = p_contractor_id and c.company_id = company and c.archived_at is null
     ) then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;

  p_role := nullif(btrim(coalesce(p_role, '')), '');
  if char_length(coalesce(p_role, '')) > 120 then
    raise exception 'SUBBIES_INVALID_INPUT' using errcode = 'P0001';
  end if;

  insert into public.project_contractors (project_id, contractor_id, role_on_project)
  values (p_project_id, p_contractor_id, p_role)
  returning id into new_id;
  return new_id;
end;
$$;


-- 6. Reopening a completed project ----------------------------------------------
-- Completed projects don't count, so without this a company could complete
-- projects, create more, then reopen the old ones past its limit. Runs as a
-- BEFORE trigger: the row is still 'completed' when the count runs, so it
-- isn't counted against itself.
create or replace function public.subbies_projects_reopen_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'completed' and new.status is distinct from 'completed' then
    perform public.subbies_assert_can_add(new.company_id, 'projects');
  end if;
  return new;
end;
$$;

drop trigger if exists projects_reopen_guard on public.projects;
create trigger projects_reopen_guard
  before update of status on public.projects
  for each row
  execute function public.subbies_projects_reopen_guard();


-- Grants --------------------------------------------------------------------------
revoke all on function public.subbies_plan_limit(text, text) from public, anon, authenticated;
revoke all on function public.subbies_assert_can_add(uuid, text) from public, anon, authenticated;
revoke all on function public.subbies_projects_reopen_guard() from public, anon, authenticated;
revoke all on function public.archive_contractor(uuid) from public, anon;
revoke all on function public.restore_contractor(uuid) from public, anon;
revoke all on function public.assign_project_contractor(uuid, uuid, text) from public, anon;
grant execute on function public.archive_contractor(uuid) to authenticated;
grant execute on function public.restore_contractor(uuid) to authenticated;
grant execute on function public.assign_project_contractor(uuid, uuid, text) to authenticated;
