-- Subbies — security audit fixes (H1, H2, M2, M3, M4, M6, L3, L5)
-- ===========================================================================
-- This file has TWO parts. Run them at different times.
--
--   PART A (additive): run FIRST, before the new code ships. Only adds
--     functions, tables, columns and indexes, plus two small data fixes
--     (old links get a real expiry; duplicate empty companies are removed).
--     The current code keeps working unchanged after Part A.
--
--   PART B (restrictive): run LAST, only after the new code is live. Removes
--     the direct-insert policies and narrows what a signed-in user can update.
--     The OLD code relies on those policies, so running Part B early would
--     break adding contractors, document types and projects.
--
-- Both parts are idempotent: safe to re-run. Each runs in one transaction,
-- so a failure part-way changes nothing.
--
-- Plan limits below MUST match lib/billing/plans.ts. A test
-- (lib/billing/plan-limits-sql.test.ts) reads this file and compares them.
-- ===========================================================================


-- ===========================================================================
-- ===== PART A: copy from here ...                                      =====
-- ===========================================================================
begin;

-- A0. Preflight -------------------------------------------------------------
-- The create_* functions below run as their owner (the role running this
-- script) and must be able to write past RLS. That only works if this role
-- owns the tables or has BYPASSRLS. If neither is true, stop now before
-- anything is created.
do $$
declare
  blocked text;
begin
  if (select rolbypassrls from pg_roles where rolname = current_user) then
    return;
  end if;
  select string_agg(tablename, ', ' order by tablename) into blocked
    from pg_tables
   where schemaname = 'public'
     and tablename in ('companies', 'contractors', 'contractor_documents', 'contractor_tokens',
                       'document_types', 'projects', 'project_contractors', 'subscriptions')
     and tableowner <> current_user;
  if blocked is not null then
    raise exception 'Stopped before changing anything: role % neither owns (%) nor bypasses RLS. Send this message to Claude.',
      current_user, blocked;
  end if;
end $$;


-- A1. Shared helpers ----------------------------------------------------------

-- Does this company have live access? Same rule as lib/billing/entitlements.ts
-- (paidAccess): trialing, active or past_due.
-- ACCESS_STATUSES: trialing,active,past_due
create or replace function public.subbies_company_has_access(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
     where s.company_id = p_company_id
       and s.status in ('trialing', 'active', 'past_due')
  );
$$;

-- A plan's limit for one resource. NULL = unlimited, 0 = not included.
-- An unknown plan (or no plan) gets 0, like NO_PLAN_LIMITS in
-- lib/billing/entitlements.ts.
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
      ('starter',  'projects',       0),
      ('business', 'contractors',    25),
      ('business', 'document_types', 15),
      ('business', 'projects',       10),
      ('pro',      'contractors',    null::integer),
      ('pro',      'document_types', null::integer),
      ('pro',      'projects',       null::integer)
      -- PLAN_LIMITS_END
    ) as l(plan, resource, lim)
   where l.plan = p_plan and l.resource = p_resource;
  -- No row (unknown plan, or no plan at all): nothing is creatable.
  if not found then
    return 0;
  end if;
  return found_limit;
end;
$$;

-- The signed-in caller's company, or NULL.
create or replace function public.subbies_caller_company()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.companies c
   where c.user_id = auth.uid()
   order by c.created_at nulls first, c.id
   limit 1;
$$;

-- Checks access and the plan limit for one resource, holding a per-company
-- lock until the transaction ends, so two parallel creates can't both see
-- "one slot left". Raises SUBBIES_NO_ACCESS or SUBBIES_LIMIT_REACHED.
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
    select count(*) into used from public.contractors where company_id = p_company_id;
  elsif p_resource = 'document_types' then
    select count(*) into used from public.document_types where company_id = p_company_id;
  elsif p_resource = 'projects' then
    select count(*) into used from public.projects where company_id = p_company_id;
  else
    raise exception 'unknown resource %', p_resource;
  end if;

  if used >= lim then
    raise exception 'SUBBIES_LIMIT_REACHED' using errcode = 'P0001';
  end if;
end;
$$;


-- A2. Create functions (H2) ---------------------------------------------------
-- The app calls these instead of inserting into the tables. Each one finds
-- the caller's company itself (there is no company id to tamper with),
-- checks access and the plan limit, validates, then inserts. After Part B
-- they are the only way a signed-in user can create these rows.

create or replace function public.create_contractor(
  p_business_name text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_trade text,
  p_document_type_ids uuid[]
)
returns table (contractor_id uuid, token uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  company uuid := public.subbies_caller_company();
  new_contractor uuid;
  new_token uuid;
  wanted integer;
  owned integer;
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;

  p_business_name := btrim(coalesce(p_business_name, ''));
  p_contact_name := nullif(btrim(coalesce(p_contact_name, '')), '');
  p_email := lower(btrim(coalesce(p_email, '')));
  p_phone := nullif(btrim(coalesce(p_phone, '')), '');
  p_trade := nullif(btrim(coalesce(p_trade, '')), '');

  if char_length(p_business_name) not between 1 and 120
     or char_length(coalesce(p_contact_name, '')) > 120
     or char_length(p_email) > 254
     or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or char_length(coalesce(p_phone, '')) > 40
     or char_length(coalesce(p_trade, '')) > 80 then
    raise exception 'SUBBIES_INVALID_INPUT' using errcode = 'P0001';
  end if;

  select count(distinct d) into wanted from unnest(coalesce(p_document_type_ids, '{}'::uuid[])) as d;
  if wanted = 0 or wanted > 50 then
    raise exception 'SUBBIES_INVALID_INPUT' using errcode = 'P0001';
  end if;
  select count(*) into owned
    from public.document_types dt
   where dt.company_id = company
     and dt.id = any (p_document_type_ids);
  if owned <> wanted then
    raise exception 'SUBBIES_UNKNOWN_DOCUMENT_TYPE' using errcode = 'P0001';
  end if;

  perform public.subbies_assert_can_add(company, 'contractors');

  insert into public.contractors (company_id, business_name, contact_name, email, phone, trade, status)
  values (company, p_business_name, p_contact_name, p_email, p_phone, p_trade, 'pending')
  returning id into new_contractor;

  insert into public.contractor_documents (contractor_id, document_type_id, status)
  select new_contractor, d, 'requested'
    from (select distinct unnest(p_document_type_ids) as d) ids;

  insert into public.contractor_tokens (contractor_id)
  values (new_contractor)
  returning contractor_tokens.token into new_token;

  return query select new_contractor, new_token;
end;
$$;

create or replace function public.create_document_type(
  p_name text,
  p_default_duration_months integer,
  p_reminder_days integer[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid := public.subbies_caller_company();
  new_id uuid;
  days integer[] := coalesce(p_reminder_days, '{}'::integer[]);
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;

  p_name := btrim(coalesce(p_name, ''));
  if char_length(p_name) not between 1 and 80
     or p_default_duration_months is null
     or p_default_duration_months not between 1 and 120
     or coalesce(array_length(days, 1), 0) > 10
     or exists (select 1 from unnest(days) d where d is null or d < 1 or d > 3650) then
    raise exception 'SUBBIES_INVALID_INPUT' using errcode = 'P0001';
  end if;

  perform public.subbies_assert_can_add(company, 'document_types');

  insert into public.document_types (company_id, name, default_duration_months, reminder_days)
  values (company, p_name, p_default_duration_months, days)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.create_project(
  p_name text,
  p_address text,
  p_status text,
  p_start_date date,
  p_end_date date
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

  p_name := btrim(coalesce(p_name, ''));
  p_address := nullif(btrim(coalesce(p_address, '')), '');
  if char_length(p_name) not between 1 and 120
     or char_length(coalesce(p_address, '')) > 250
     or coalesce(p_status, '') not in ('active', 'on_hold', 'completed')
     or (p_start_date is not null and p_end_date is not null and p_end_date < p_start_date) then
    raise exception 'SUBBIES_INVALID_INPUT' using errcode = 'P0001';
  end if;

  perform public.subbies_assert_can_add(company, 'projects');

  insert into public.projects (company_id, name, address, status, start_date, end_date)
  values (company, p_name, p_address, p_status, p_start_date, p_end_date)
  returning id into new_id;
  return new_id;
end;
$$;

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
     or not exists (select 1 from public.contractors c where c.id = p_contractor_id and c.company_id = company) then
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


-- A3. Email send log and daily cap (H1) ---------------------------------------
create table if not exists public.email_send_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists email_send_log_company_created_idx
  on public.email_send_log (company_id, created_at desc);
alter table public.email_send_log enable row level security;

-- Reserves one send for a company if it is under its cap for the window.
-- Returns the reservation id, or NULL when the cap is reached. Atomic: a
-- per-company lock means parallel sends can't all slip under the cap. Also
-- tidies that company's rows older than two days, so the log stays small.
create or replace function public.claim_email_send(
  p_company_id uuid,
  p_kind text,
  p_cap integer,
  p_window_seconds integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('subbies-email:' || p_company_id::text));

  delete from public.email_send_log
   where company_id = p_company_id
     and created_at < now() - interval '2 days';

  select count(*) into used
    from public.email_send_log
   where company_id = p_company_id
     and created_at > now() - make_interval(secs => p_window_seconds);
  if used >= p_cap then
    return null;
  end if;

  insert into public.email_send_log (company_id, kind)
  values (p_company_id, p_kind)
  returning id into new_id;
  return new_id;
end;
$$;


-- A4. Resend cooldown, out of the user-writable token row (H1) ---------------
create table if not exists public.contractor_request_cooldowns (
  contractor_id uuid primary key references public.contractors(id) on delete cascade,
  last_sent_at timestamptz not null
);
alter table public.contractor_request_cooldowns enable row level security;

-- Carry over the existing stamps so nobody gets a free resend on deploy day.
insert into public.contractor_request_cooldowns (contractor_id, last_sent_at)
select t.contractor_id, t.last_request_sent_at
  from public.contractor_tokens t
 where t.last_request_sent_at is not null
on conflict (contractor_id) do nothing;

-- One atomic statement: takes the slot only if the last send is older than
-- the window. Returns true if this call claimed it.
create or replace function public.claim_request_cooldown(p_contractor_id uuid, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed uuid;
begin
  insert into public.contractor_request_cooldowns as c (contractor_id, last_sent_at)
  values (p_contractor_id, now())
  on conflict (contractor_id) do update
     set last_sent_at = excluded.last_sent_at
   where c.last_sent_at < now() - make_interval(secs => p_window_seconds)
  returning c.contractor_id into claimed;
  return claimed is not null;
end;
$$;

-- Hands a just-claimed slot back when the email didn't go out. Only removes
-- a stamp from the last two minutes, so it can't wipe an older real send.
create or replace function public.release_request_cooldown(p_contractor_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.contractor_request_cooldowns
   where contractor_id = p_contractor_id
     and last_sent_at > now() - interval '2 minutes';
$$;


-- A5. Links that never expire get a real expiry (M2) -------------------------
-- Rows created before 0014 have expires_at = NULL ("never expires"). They now
-- expire 60 days from today, the same as a fresh link. Any email the app
-- sends a contractor extends their link again, so an active contractor never
-- notices. On 2026-11-10 this affected 3 rows.
update public.contractor_tokens
   set expires_at = now() + interval '60 days'
 where expires_at is null;

-- 0012 (never applied to this database) would have made tokens unique.
-- Random UUIDs can't collide in practice; this makes it a guarantee.
create unique index if not exists contractor_tokens_token_uniq
  on public.contractor_tokens (token);


-- A6. Owner email throttle per document (M3) ----------------------------------
alter table public.contractor_documents
  add column if not exists last_owner_notified_at timestamptz;


-- A7. Deletion code attempts, counted atomically (M4) ------------------------
-- Uses up one attempt and returns the code to compare against, in a single
-- statement. Returns no row when there's no code or no attempts left, so
-- parallel guesses can't share one attempt.
create or replace function public.consume_deletion_code_attempt(p_user_id uuid, p_max_attempts integer)
returns table (code_hash text, expires_at timestamptz, attempts integer)
language sql
security definer
set search_path = ''
as $$
  update public.account_deletion_codes d
     set attempts = d.attempts + 1
   where d.user_id = p_user_id
     and d.attempts < p_max_attempts
  returning d.code_hash, d.expires_at, d.attempts;
$$;


-- A8. One free trial per card (M6) --------------------------------------------
create table if not exists public.trial_card_fingerprints (
  fingerprint text primary key,
  first_company_id uuid,
  created_at timestamptz not null default now()
);
alter table public.trial_card_fingerprints enable row level security;

-- Records the card's first trial. Returns true if this company may have the
-- trial: the card is new, or it's this same company again (a webhook retry).
create or replace function public.claim_trial_fingerprint(p_fingerprint text, p_company_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_company uuid;
begin
  insert into public.trial_card_fingerprints (fingerprint, first_company_id)
  values (p_fingerprint, p_company_id)
  on conflict (fingerprint) do nothing;

  select f.first_company_id into owner_company
    from public.trial_card_fingerprints f
   where f.fingerprint = p_fingerprint;
  return owner_company is not distinct from p_company_id;
end;
$$;


-- A9. One company per user (L3) -------------------------------------------------
create table if not exists public.companies_duplicate_report (
  company_id uuid primary key,
  user_id uuid not null,
  reason text not null,
  reported_at timestamptz not null default now()
);
alter table public.companies_duplicate_report enable row level security;

-- Keeps the oldest company per user. A newer duplicate with no data at all
-- is deleted. One that has data is NOT touched: it's listed in
-- companies_duplicate_report and the unique index is skipped, so it can be
-- looked at by hand. (On 2026-11-10 there were no duplicates.)
do $$
declare
  dup record;
begin
  for dup in
    select c.id, c.user_id
      from public.companies c
     where exists (
       select 1 from public.companies o
        where o.user_id = c.user_id
          and (coalesce(o.created_at, '-infinity'::timestamptz), o.id)
            < (coalesce(c.created_at, '-infinity'::timestamptz), c.id)
     )
  loop
    if exists (select 1 from public.contractors where company_id = dup.id)
       or exists (select 1 from public.document_types where company_id = dup.id)
       or exists (select 1 from public.projects where company_id = dup.id)
       or exists (select 1 from public.subscriptions where company_id = dup.id) then
      insert into public.companies_duplicate_report (company_id, user_id, reason)
      values (dup.id, dup.user_id, 'duplicate company with data, left in place')
      on conflict (company_id) do nothing;
    else
      delete from public.companies where id = dup.id;
    end if;
  end loop;

  if exists (select 1 from public.companies group by user_id having count(*) > 1) then
    raise notice 'Duplicate companies with data remain (see companies_duplicate_report). The unique index was NOT created. Send the report to Claude.';
  else
    execute 'create unique index if not exists companies_user_id_key on public.companies (user_id)';
  end if;
end $$;


-- A10. Rate limiter: atomic, plus a purge (L5) ---------------------------------
-- Same signature as 0017, so the running app keeps working. The per-key lock
-- makes count-then-insert one atomic step; parallel requests queue instead
-- of all passing the count.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count int;
begin
  perform pg_advisory_xact_lock(hashtext('subbies-rate:' || p_bucket || ':' || p_key));

  delete from public.rate_limit_hits
   where bucket = p_bucket
     and key = p_key
     and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into current_count
    from public.rate_limit_hits
   where bucket = p_bucket
     and key = p_key;

  if current_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket, key) values (p_bucket, p_key);
  return true;
end;
$$;

-- Drops hits older than the given age across all keys (keys that never come
-- back are otherwise never cleaned). Called by the daily cleanup cron.
create or replace function public.purge_rate_limit_hits(p_older_than_seconds integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.rate_limit_hits
   where created_at < now() - make_interval(secs => p_older_than_seconds);
  get diagnostics removed = row_count;
  return removed;
end;
$$;


-- A11. Who may call what ----------------------------------------------------------
-- Supabase grants EXECUTE on new functions to anon and authenticated by
-- default, so every function is locked down explicitly.

-- Internal helpers: nobody calls these directly.
revoke all on function public.subbies_company_has_access(uuid) from public, anon, authenticated;
revoke all on function public.subbies_plan_limit(text, text) from public, anon, authenticated;
revoke all on function public.subbies_caller_company() from public, anon, authenticated;
revoke all on function public.subbies_assert_can_add(uuid, text) from public, anon, authenticated;

-- Called by the app with the signed-in user's session.
revoke all on function public.create_contractor(text, text, text, text, text, uuid[]) from public, anon;
revoke all on function public.create_document_type(text, integer, integer[]) from public, anon;
revoke all on function public.create_project(text, text, text, date, date) from public, anon;
revoke all on function public.assign_project_contractor(uuid, uuid, text) from public, anon;
grant execute on function public.create_contractor(text, text, text, text, text, uuid[]) to authenticated;
grant execute on function public.create_document_type(text, integer, integer[]) to authenticated;
grant execute on function public.create_project(text, text, text, date, date) to authenticated;
grant execute on function public.assign_project_contractor(uuid, uuid, text) to authenticated;

-- Server-only (service role).
revoke all on function public.claim_email_send(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.claim_request_cooldown(uuid, integer) from public, anon, authenticated;
revoke all on function public.release_request_cooldown(uuid) from public, anon, authenticated;
revoke all on function public.consume_deletion_code_attempt(uuid, integer) from public, anon, authenticated;
revoke all on function public.claim_trial_fingerprint(text, uuid) from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, text, int, int) from public, anon, authenticated;
revoke all on function public.purge_rate_limit_hits(integer) from public, anon, authenticated;
grant execute on function public.claim_email_send(uuid, text, integer, integer) to service_role;
grant execute on function public.claim_request_cooldown(uuid, integer) to service_role;
grant execute on function public.release_request_cooldown(uuid) to service_role;
grant execute on function public.consume_deletion_code_attempt(uuid, integer) to service_role;
grant execute on function public.claim_trial_fingerprint(text, uuid) to service_role;
grant execute on function public.check_rate_limit(text, text, int, int) to service_role;
grant execute on function public.purge_rate_limit_hits(integer) to service_role;

-- New tables: RLS on with no policies already denies the API roles; this
-- makes it explicit.
revoke all on table public.email_send_log from anon, authenticated;
revoke all on table public.contractor_request_cooldowns from anon, authenticated;
revoke all on table public.trial_card_fingerprints from anon, authenticated;
revoke all on table public.companies_duplicate_report from anon, authenticated;

commit;

notify pgrst, 'reload schema';
-- ===========================================================================
-- ===== ... to here. END OF PART A                                      =====
-- ===========================================================================


-- ===========================================================================
-- ===== PART B: run ONLY after the new code is live. Copy from here ... =====
-- ===========================================================================
begin;

-- B1. contractors: no direct insert; updates limited to profile fields -------
drop policy if exists "own company contractors" on public.contractors;
drop policy if exists "own company contractors select" on public.contractors;
drop policy if exists "own company contractors update" on public.contractors;
drop policy if exists "own company contractors delete" on public.contractors;
create policy "own company contractors select" on public.contractors
  for select to authenticated
  using (company_id in (select id from public.companies where user_id = auth.uid()));
create policy "own company contractors update" on public.contractors
  for update to authenticated
  using (company_id in (select id from public.companies where user_id = auth.uid()))
  with check (company_id in (select id from public.companies where user_id = auth.uid()));
create policy "own company contractors delete" on public.contractors
  for delete to authenticated
  using (company_id in (select id from public.companies where user_id = auth.uid()));
revoke insert, update on table public.contractors from anon, authenticated;
grant update (business_name, contact_name, email, phone, trade, abn, status)
  on table public.contractors to authenticated;

-- B2. document_types -------------------------------------------------------------
drop policy if exists "own company document_types" on public.document_types;
drop policy if exists "own company document_types select" on public.document_types;
drop policy if exists "own company document_types update" on public.document_types;
drop policy if exists "own company document_types delete" on public.document_types;
create policy "own company document_types select" on public.document_types
  for select to authenticated
  using (company_id in (select id from public.companies where user_id = auth.uid()));
create policy "own company document_types update" on public.document_types
  for update to authenticated
  using (company_id in (select id from public.companies where user_id = auth.uid()))
  with check (company_id in (select id from public.companies where user_id = auth.uid()));
create policy "own company document_types delete" on public.document_types
  for delete to authenticated
  using (company_id in (select id from public.companies where user_id = auth.uid()));
revoke insert, update on table public.document_types from anon, authenticated;
grant update (name, default_duration_months, reminder_days)
  on table public.document_types to authenticated;

-- B3. projects -------------------------------------------------------------------
drop policy if exists "own company projects" on public.projects;
drop policy if exists "own company projects select" on public.projects;
drop policy if exists "own company projects update" on public.projects;
drop policy if exists "own company projects delete" on public.projects;
create policy "own company projects select" on public.projects
  for select to authenticated
  using (company_id in (select id from public.companies where user_id = auth.uid()));
create policy "own company projects update" on public.projects
  for update to authenticated
  using (company_id in (select id from public.companies where user_id = auth.uid()))
  with check (company_id in (select id from public.companies where user_id = auth.uid()));
create policy "own company projects delete" on public.projects
  for delete to authenticated
  using (company_id in (select id from public.companies where user_id = auth.uid()));
revoke insert, update on table public.projects from anon, authenticated;
grant update (name, address, status, start_date, end_date)
  on table public.projects to authenticated;

-- B4. project_contractors ---------------------------------------------------------
drop policy if exists "own company project_contractors" on public.project_contractors;
drop policy if exists "own company project_contractors select" on public.project_contractors;
drop policy if exists "own company project_contractors update" on public.project_contractors;
drop policy if exists "own company project_contractors delete" on public.project_contractors;
create policy "own company project_contractors select" on public.project_contractors
  for select to authenticated
  using (project_id in (select p.id from public.projects p join public.companies co on co.id = p.company_id
                         where co.user_id = auth.uid()));
create policy "own company project_contractors update" on public.project_contractors
  for update to authenticated
  using (project_id in (select p.id from public.projects p join public.companies co on co.id = p.company_id
                         where co.user_id = auth.uid()))
  with check (project_id in (select p.id from public.projects p join public.companies co on co.id = p.company_id
                              where co.user_id = auth.uid()));
create policy "own company project_contractors delete" on public.project_contractors
  for delete to authenticated
  using (project_id in (select p.id from public.projects p join public.companies co on co.id = p.company_id
                         where co.user_id = auth.uid()));
revoke insert, update on table public.project_contractors from anon, authenticated;
grant update (role_on_project, removed_at)
  on table public.project_contractors to authenticated;

-- B5. contractor_tokens: read-only for the owner --------------------------------
-- Token, expiry and the old cooldown column are now written only by the
-- server (service role), after it has checked ownership.
drop policy if exists "own company contractor_tokens" on public.contractor_tokens;
drop policy if exists "own company contractor_tokens select" on public.contractor_tokens;
create policy "own company contractor_tokens select" on public.contractor_tokens
  for select to authenticated
  using (contractor_id in (select c.id from public.contractors c join public.companies co on co.id = c.company_id
                            where co.user_id = auth.uid()));
revoke insert, update, delete on table public.contractor_tokens from anon, authenticated;

-- B6. contractor_documents: keep the policy, narrow the updatable columns -------
-- The owner can still review documents (status, expiry, rejection, archive),
-- but can't move a document to another contractor or retype it.
revoke update on table public.contractor_documents from anon, authenticated;
grant update (status, expiry_date, rejection_reason, replaces_document_id, archived_at, updated_at, file_url)
  on table public.contractor_documents to authenticated;

commit;

notify pgrst, 'reload schema';
-- ===========================================================================
-- ===== ... to here. END OF PART B                                      =====
-- ===========================================================================
