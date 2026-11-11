-- 0022: project workspace (upgrade Phase 2)
--
-- Additive and idempotent. Safe to apply before the Phase 2 code ships: it
-- only adds tables, indexes and functions; nothing existing changes shape or
-- behaviour, and the deployed code never reads the new tables.
--
-- 1. Supporting unique indexes so child rows can carry composite FKs and
--    can't point across companies.
-- 2. project_requirements: which document types a project needs.
-- 3. project_activity: append-only audit log per project.
-- 4. project_contractor_status: last known compliance status per project and
--    contractor, so each real change is recorded exactly once. Server-only.
-- 5. Plan feature gate in SQL (mirrors FEATURE_MIN_PLAN in lib/billing/plans.ts).
-- 6. Functions: activity recording, requirement add/update/remove, status sync.
-- 7. Grants: no direct writes from client roles; reads through RLS.
--
-- Requires 0020 (subbies_caller_company, subbies_company_has_access).
-- Rollback: see docs/upgrade/MIGRATIONS.md.


-- 1. Supporting unique indexes ------------------------------------------------
create unique index if not exists projects_id_company_uniq on public.projects (id, company_id);
create unique index if not exists document_types_id_company_uniq on public.document_types (id, company_id);
create unique index if not exists contractors_id_company_uniq on public.contractors (id, company_id);


-- 2. Project requirements ---------------------------------------------------------
create table if not exists public.project_requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  document_type_id uuid not null,
  is_mandatory boolean not null default true,
  min_days_valid integer null check (min_days_valid is null or min_days_valid between 0 and 3650),
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint project_requirements_project_type_uniq unique (project_id, document_type_id),
  constraint project_requirements_project_fk
    foreign key (project_id, company_id) references public.projects (id, company_id) on delete cascade,
  -- NO ACTION rather than RESTRICT: same effect when someone deletes a
  -- document type that's in use (refused, and the app says "Used by N
  -- projects"), but checked at the end of the statement, so deleting a whole
  -- company still cascades cleanly through projects first.
  constraint project_requirements_document_type_fk
    foreign key (document_type_id, company_id) references public.document_types (id, company_id) on delete no action
);
create index if not exists project_requirements_company_idx on public.project_requirements (company_id);
create index if not exists project_requirements_document_type_idx on public.project_requirements (document_type_id);
alter table public.project_requirements enable row level security;

drop policy if exists "own company project_requirements select" on public.project_requirements;
create policy "own company project_requirements select" on public.project_requirements
  for select to authenticated
  using (company_id in (select c.id from public.companies c where c.user_id = (select auth.uid())));


-- 3. Project activity (append-only) ----------------------------------------------
create table if not exists public.project_activity (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  event_type text not null check (event_type in (
    'project_created', 'project_updated', 'contractor_assigned', 'contractor_removed',
    'requirement_added', 'requirement_removed', 'document_uploaded', 'document_approved',
    'document_rejected', 'document_replaced', 'document_expired', 'compliance_status_changed',
    'photo_added', 'photo_removed', 'photo_replaced', 'location_changed',
    'project_archived', 'project_completed'
  )),
  -- The sentence as written at the time. An audit record: never rewritten.
  description text not null check (char_length(description) between 1 and 500),
  actor_user_id uuid null references auth.users(id) on delete set null,
  contractor_id uuid null references public.contractors(id) on delete set null,
  document_id uuid null references public.contractor_documents(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint project_activity_project_fk
    foreign key (project_id, company_id) references public.projects (id, company_id) on delete cascade
);
create index if not exists project_activity_project_created_idx on public.project_activity (project_id, created_at desc, id desc);
create index if not exists project_activity_company_idx on public.project_activity (company_id);
create index if not exists project_activity_contractor_idx on public.project_activity (contractor_id);
create index if not exists project_activity_document_idx on public.project_activity (document_id);
-- A document expires once per project: the daily job can re-run safely.
create unique index if not exists project_activity_expired_once
  on public.project_activity (project_id, document_id)
  where event_type = 'document_expired';
alter table public.project_activity enable row level security;

drop policy if exists "own company project_activity select" on public.project_activity;
create policy "own company project_activity select" on public.project_activity
  for select to authenticated
  using (company_id in (select c.id from public.companies c where c.user_id = (select auth.uid())));


-- 4. Last known status per project and contractor (server-only) ------------------
create table if not exists public.project_contractor_status (
  project_id uuid not null,
  contractor_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null check (status in ('compliant', 'expiring', 'pending_review', 'not_cleared')),
  updated_at timestamptz not null default now(),
  primary key (project_id, contractor_id),
  constraint project_contractor_status_project_fk
    foreign key (project_id, company_id) references public.projects (id, company_id) on delete cascade,
  constraint project_contractor_status_contractor_fk
    foreign key (contractor_id, company_id) references public.contractors (id, company_id) on delete cascade
);
create index if not exists project_contractor_status_company_idx on public.project_contractor_status (company_id);
create index if not exists project_contractor_status_contractor_idx on public.project_contractor_status (contractor_id);
alter table public.project_contractor_status enable row level security;


-- 5. Plan feature gate ----------------------------------------------------------------
-- Does this plan include the feature? Unknown plan or feature: no.
create or replace function public.subbies_plan_has_feature(p_plan text, p_feature text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  min_plan text;
  plan_rank integer;
  need_rank integer;
begin
  select f.min_plan into min_plan
    from (values
      -- PLAN_FEATURES_BEGIN (must match FEATURE_MIN_PLAN in lib/billing/plans.ts)
      ('projectCompliance', 'starter'),
      ('map',               'starter'),
      ('photos',            'starter'),
      ('requirements',      'business'),
      ('documentRegister',  'business'),
      ('activityView',      'business'),
      ('pdfExport',         'business'),
      ('analytics',         'pro'),
      ('team',              'pro'),
      ('bulkTools',         'pro'),
      ('auditExports',      'pro'),
      ('prioritySupport',   'pro')
      -- PLAN_FEATURES_END
    ) as f(feature, min_plan)
   where f.feature = p_feature;
  if not found then
    return false;
  end if;
  plan_rank := case p_plan when 'starter' then 1 when 'business' then 2 when 'pro' then 3 else 0 end;
  need_rank := case min_plan when 'starter' then 1 when 'business' then 2 when 'pro' then 3 else 99 end;
  return plan_rank >= need_rank;
end;
$$;

-- Live access and the plan includes the feature.
create or replace function public.subbies_company_has_feature(p_company_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.subbies_company_has_access(p_company_id)
     and public.subbies_plan_has_feature(
           (select s.plan from public.subscriptions s where s.company_id = p_company_id),
           p_feature);
$$;


-- 6a. Activity recording -----------------------------------------------------------------
-- The one insert path. Checks every reference belongs to the company. Returns
-- the new id, or NULL when the row already exists (document_expired re-run).
create or replace function public.subbies_insert_project_activity(
  p_company_id uuid,
  p_project_id uuid,
  p_event_type text,
  p_description text,
  p_actor uuid,
  p_contractor_id uuid,
  p_document_id uuid,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not exists (select 1 from public.projects p where p.id = p_project_id and p.company_id = p_company_id) then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_contractor_id is not null
     and not exists (select 1 from public.contractors c where c.id = p_contractor_id and c.company_id = p_company_id) then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_document_id is not null
     and not exists (
       select 1 from public.contractor_documents d
         join public.contractors c on c.id = d.contractor_id
        where d.id = p_document_id and c.company_id = p_company_id
     ) then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;

  begin
    insert into public.project_activity
      (company_id, project_id, event_type, description, actor_user_id, contractor_id, document_id, metadata)
    values
      (p_company_id, p_project_id, p_event_type, left(btrim(p_description), 500), p_actor,
       p_contractor_id, p_document_id, coalesce(p_metadata, '{}'::jsonb))
    returning id into new_id;
  exception when unique_violation then
    return null;
  end;
  return new_id;
end;
$$;

-- Signed-in caller, one project. System-only events can't be written this way.
create or replace function public.record_project_activity(
  p_project_id uuid,
  p_event_type text,
  p_description text,
  p_contractor_id uuid default null,
  p_document_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid := public.subbies_caller_company();
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;
  if p_event_type in ('document_expired', 'compliance_status_changed') then
    raise exception 'SUBBIES_INVALID_INPUT' using errcode = 'P0001';
  end if;
  return public.subbies_insert_project_activity(
    company, p_project_id, p_event_type, p_description, auth.uid(), p_contractor_id, p_document_id, p_metadata);
end;
$$;

-- One event for every project the contractor is currently assigned to (a
-- document upload or review touches all of them). Returns how many rows.
create or replace function public.subbies_record_contractor_activity(
  p_company_id uuid,
  p_contractor_id uuid,
  p_event_type text,
  p_description text,
  p_actor uuid,
  p_document_id uuid,
  p_metadata jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  pc record;
  written integer := 0;
begin
  for pc in
    select distinct a.project_id
      from public.project_contractors a
      join public.projects p on p.id = a.project_id
     where a.contractor_id = p_contractor_id
       and a.removed_at is null
       and p.company_id = p_company_id
  loop
    if public.subbies_insert_project_activity(
         p_company_id, pc.project_id, p_event_type, p_description, p_actor,
         p_contractor_id, p_document_id, p_metadata) is not null then
      written := written + 1;
    end if;
  end loop;
  return written;
end;
$$;

create or replace function public.record_contractor_activity(
  p_contractor_id uuid,
  p_event_type text,
  p_description text,
  p_document_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid := public.subbies_caller_company();
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;
  if p_event_type in ('document_expired', 'compliance_status_changed') then
    raise exception 'SUBBIES_INVALID_INPUT' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.contractors c where c.id = p_contractor_id and c.company_id = company) then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;
  return public.subbies_record_contractor_activity(
    company, p_contractor_id, p_event_type, p_description, auth.uid(), p_document_id, p_metadata);
end;
$$;


-- 6b. Requirements (Business and up) ---------------------------------------------------
create or replace function public.add_project_requirement(
  p_project_id uuid,
  p_document_type_id uuid,
  p_is_mandatory boolean,
  p_min_days_valid integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid := public.subbies_caller_company();
  type_name text;
  new_id uuid;
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;
  if not public.subbies_company_has_access(company) then
    raise exception 'SUBBIES_NO_ACCESS' using errcode = 'P0001';
  end if;
  if not public.subbies_company_has_feature(company, 'requirements') then
    raise exception 'SUBBIES_FEATURE_NOT_IN_PLAN' using errcode = 'P0001';
  end if;
  if p_min_days_valid is not null and p_min_days_valid not between 0 and 3650 then
    raise exception 'SUBBIES_INVALID_INPUT' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.projects p where p.id = p_project_id and p.company_id = company) then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;
  select dt.name into type_name from public.document_types dt
   where dt.id = p_document_type_id and dt.company_id = company;
  if type_name is null then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;

  begin
    insert into public.project_requirements (company_id, project_id, document_type_id, is_mandatory, min_days_valid, created_by)
    values (company, p_project_id, p_document_type_id, coalesce(p_is_mandatory, true), p_min_days_valid, auth.uid())
    returning id into new_id;
  exception when unique_violation then
    raise exception 'SUBBIES_ALREADY_REQUIRED' using errcode = 'P0001';
  end;

  perform public.subbies_insert_project_activity(
    company, p_project_id, 'requirement_added',
    'Added requirement: ' || type_name || case when coalesce(p_is_mandatory, true) then ' (mandatory)' else ' (optional)' end,
    auth.uid(), null, null,
    jsonb_build_object('document_type_id', p_document_type_id, 'requirement_id', new_id));
  return new_id;
end;
$$;

create or replace function public.update_project_requirement(
  p_requirement_id uuid,
  p_is_mandatory boolean,
  p_min_days_valid integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid := public.subbies_caller_company();
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;
  if not public.subbies_company_has_feature(company, 'requirements') then
    raise exception 'SUBBIES_FEATURE_NOT_IN_PLAN' using errcode = 'P0001';
  end if;
  if p_is_mandatory is null or (p_min_days_valid is not null and p_min_days_valid not between 0 and 3650) then
    raise exception 'SUBBIES_INVALID_INPUT' using errcode = 'P0001';
  end if;
  update public.project_requirements r
     set is_mandatory = p_is_mandatory, min_days_valid = p_min_days_valid
   where r.id = p_requirement_id and r.company_id = company;
  if not found then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$$;

-- Removing only ever relaxes compliance, so it needs no plan feature: a
-- company that downgraded can still tidy up what it set up (D7).
create or replace function public.remove_project_requirement(p_requirement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid := public.subbies_caller_company();
  gone record;
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;
  delete from public.project_requirements r
   where r.id = p_requirement_id and r.company_id = company
  returning r.project_id, r.document_type_id into gone;
  if gone.project_id is null then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.subbies_insert_project_activity(
    company, gone.project_id, 'requirement_removed',
    'Removed requirement: ' || coalesce((select dt.name from public.document_types dt where dt.id = gone.document_type_id), 'document type'),
    auth.uid(), null, null,
    jsonb_build_object('document_type_id', gone.document_type_id));
end;
$$;


-- 6c. Status sync ------------------------------------------------------------------------
-- p_rows: [{"project_id": uuid, "contractor_id": uuid, "status": text}, ...]
-- Records compliance_status_changed only when a known status really changes.
-- The first time a pair is seen it's stored silently: no invented history.
-- Locks each ledger row, so two syncs can't both record the same change.
create or replace function public.subbies_sync_project_statuses(p_company_id uuid, p_rows jsonb, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  pid uuid;
  cid uuid;
  new_status text;
  old_status text;
  who text;
  changed integer := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'SUBBIES_INVALID_INPUT' using errcode = 'P0001';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    pid := (r->>'project_id')::uuid;
    cid := (r->>'contractor_id')::uuid;
    new_status := r->>'status';
    if new_status not in ('compliant', 'expiring', 'pending_review', 'not_cleared') then
      raise exception 'SUBBIES_INVALID_INPUT' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.projects p where p.id = pid and p.company_id = p_company_id) then
      raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
    end if;
    select c.business_name into who from public.contractors c where c.id = cid and c.company_id = p_company_id;
    if who is null then
      raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
    end if;

    select s.status into old_status from public.project_contractor_status s
     where s.project_id = pid and s.contractor_id = cid
       for update;
    if not found then
      insert into public.project_contractor_status (project_id, contractor_id, company_id, status)
      values (pid, cid, p_company_id, new_status)
      on conflict (project_id, contractor_id) do nothing;
    elsif old_status is distinct from new_status then
      update public.project_contractor_status
         set status = new_status, updated_at = now()
       where project_id = pid and contractor_id = cid;
      perform public.subbies_insert_project_activity(
        p_company_id, pid, 'compliance_status_changed',
        who || ': ' || public.subbies_status_label(old_status) || ' to ' || lower(public.subbies_status_label(new_status)),
        p_actor, cid, null,
        jsonb_build_object('from', old_status, 'to', new_status));
      changed := changed + 1;
    end if;
  end loop;
  return changed;
end;
$$;

create or replace function public.subbies_status_label(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'compliant' then 'Compliant'
    when 'expiring' then 'Expiring soon'
    when 'pending_review' then 'Pending review'
    when 'not_cleared' then 'Not cleared'
    else 'Unknown'
  end;
$$;

create or replace function public.sync_project_statuses(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid := public.subbies_caller_company();
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;
  return public.subbies_sync_project_statuses(company, p_rows, auth.uid());
end;
$$;


-- 7. Grants ---------------------------------------------------------------------------------
-- Tables: read through RLS, write only through the functions above.
revoke insert, update, delete on table public.project_requirements from anon, authenticated;
revoke insert, update, delete on table public.project_activity from anon, authenticated;
revoke all on table public.project_contractor_status from anon, authenticated;
revoke select on table public.project_requirements from anon;
revoke select on table public.project_activity from anon;
grant select on table public.project_requirements to authenticated;
grant select on table public.project_activity to authenticated;
-- The audit log is append-only for the server too.
revoke update, delete on table public.project_activity from service_role;

-- Internal helpers: nobody calls these directly except the server.
revoke all on function public.subbies_plan_has_feature(text, text) from public, anon, authenticated;
revoke all on function public.subbies_company_has_feature(uuid, text) from public, anon, authenticated;
revoke all on function public.subbies_status_label(text) from public, anon, authenticated;
revoke all on function public.subbies_insert_project_activity(uuid, uuid, text, text, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.subbies_record_contractor_activity(uuid, uuid, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.subbies_sync_project_statuses(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.subbies_insert_project_activity(uuid, uuid, text, text, uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.subbies_record_contractor_activity(uuid, uuid, text, text, uuid, uuid, jsonb) to service_role;
grant execute on function public.subbies_sync_project_statuses(uuid, jsonb, uuid) to service_role;

-- Signed-in entry points.
revoke all on function public.record_project_activity(uuid, text, text, uuid, uuid, jsonb) from public, anon;
revoke all on function public.record_contractor_activity(uuid, text, text, uuid, jsonb) from public, anon;
revoke all on function public.add_project_requirement(uuid, uuid, boolean, integer) from public, anon;
revoke all on function public.update_project_requirement(uuid, boolean, integer) from public, anon;
revoke all on function public.remove_project_requirement(uuid) from public, anon;
revoke all on function public.sync_project_statuses(jsonb) from public, anon;
grant execute on function public.record_project_activity(uuid, text, text, uuid, uuid, jsonb) to authenticated;
grant execute on function public.record_contractor_activity(uuid, text, text, uuid, jsonb) to authenticated;
grant execute on function public.add_project_requirement(uuid, uuid, boolean, integer) to authenticated;
grant execute on function public.update_project_requirement(uuid, boolean, integer) to authenticated;
grant execute on function public.remove_project_requirement(uuid) to authenticated;
grant execute on function public.sync_project_statuses(jsonb) to authenticated;
