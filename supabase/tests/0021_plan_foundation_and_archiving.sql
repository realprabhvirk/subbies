-- Subbies: tests for migration 0021 (plan foundation and archiving)
-- ---------------------------------------------------------------------------
-- Run AFTER 0021. One transaction, rolled back at the end: it leaves no rows
-- behind. Prefer a local or staging copy of the database.
--
-- Success: the last line reads "0021 tests: all passed". Any failure stops
-- the script with the name of the check that failed.
-- ---------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAILED: %', what;
  end if;
end $$;

create function pg_temp.must_fail(stmt text, expected text, what text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if position(expected in sqlerrm) = 0 then
      raise exception 'FAILED: % (wrong error: %)', what, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FAILED: % (statement succeeded)', what;
end $$;

-- Fixtures: Starter company A with 5 contractors (at its limit), company B.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000021a0', 'a21@example.test'),
  ('00000000-0000-4000-8000-0000000021b0', 'b21@example.test');
insert into public.companies (id, user_id, name) values
  ('10000000-0000-4000-8000-0000000021a0', '00000000-0000-4000-8000-0000000021a0', 'Company A'),
  ('10000000-0000-4000-8000-0000000021b0', '00000000-0000-4000-8000-0000000021b0', 'Company B');
insert into public.subscriptions (company_id, plan, status) values
  ('10000000-0000-4000-8000-0000000021a0', 'starter', 'active'),
  ('10000000-0000-4000-8000-0000000021b0', 'starter', 'active');
insert into public.document_types (id, company_id, name) values
  ('20000000-0000-4000-8000-0000000021a0', '10000000-0000-4000-8000-0000000021a0', 'Insurance A');
insert into public.contractors (id, company_id, business_name, email)
select ('30000000-0000-4000-8000-00000000210' || g)::uuid, '10000000-0000-4000-8000-0000000021a0', 'Sub ' || g, 's' || g || '@example.test'
  from generate_series(1, 5) g;

-- Plan limits ------------------------------------------------------------------
select pg_temp.check(public.subbies_plan_limit('starter', 'projects') = 1, 'starter projects = 1');
select pg_temp.check(public.subbies_plan_limit('business', 'projects') = 10, 'business projects = 10');
select pg_temp.check(public.subbies_plan_limit('pro', 'projects') is null, 'pro projects unlimited');
select pg_temp.check(public.subbies_plan_limit('starter', 'contractors') = 5, 'starter contractors unchanged');

-- As company A's owner --------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000021a0", "role": "authenticated"}';

select pg_temp.must_fail(
  $q$select public.create_contractor('Six', null, 'six@example.test', null, null, array['20000000-0000-4000-8000-0000000021a0']::uuid[])$q$,
  'SUBBIES_LIMIT_REACHED', 'create at 5/5 refused');

select pg_temp.check(public.archive_contractor('30000000-0000-4000-8000-000000002101') is not null, 'archive returns its stamp');
select pg_temp.check(
  (select archived_at from public.contractors where id = '30000000-0000-4000-8000-000000002101')
    = public.archive_contractor('30000000-0000-4000-8000-000000002101'),
  'archiving twice keeps the first stamp');

select pg_temp.check(
  (select count(*) from public.create_contractor('Six', null, 'six@example.test', null, null, array['20000000-0000-4000-8000-0000000021a0']::uuid[])) = 1,
  'archived contractor frees a slot');

select pg_temp.must_fail($q$select public.restore_contractor('30000000-0000-4000-8000-000000002101')$q$,
  'SUBBIES_LIMIT_REACHED', 'restore past the limit refused');
select pg_temp.must_fail(
  $q$update public.contractors set archived_at = null where id = '30000000-0000-4000-8000-000000002101'$q$,
  'permission denied', 'archived_at not directly writable');

select pg_temp.check(public.create_project('Job 1', null, 'active', null, null) is not null, 'starter first project allowed');
select pg_temp.must_fail($q$select public.create_project('Job 2', null, 'active', null, null)$q$,
  'SUBBIES_LIMIT_REACHED', 'starter second project refused');
update public.projects set status = 'completed' where name = 'Job 1';
select pg_temp.check(public.create_project('Job 2', null, 'active', null, null) is not null, 'completed project frees a slot');
select pg_temp.must_fail($q$update public.projects set status = 'active' where name = 'Job 1'$q$,
  'SUBBIES_LIMIT_REACHED', 'reopening past the limit refused');
update public.projects set name = 'Job 1 (done)' where name = 'Job 1';
select pg_temp.check(exists (select 1 from public.projects where name = 'Job 1 (done)'), 'editing a completed project still works');

select pg_temp.must_fail(
  $q$select public.assign_project_contractor((select id from public.projects where name = 'Job 2'), '30000000-0000-4000-8000-000000002101', null)$q$,
  'SUBBIES_NOT_FOUND', 'archived contractor cannot be assigned');
select pg_temp.check(
  public.assign_project_contractor((select id from public.projects where name = 'Job 2'), '30000000-0000-4000-8000-000000002102', null) is not null,
  'live contractor can be assigned');

select public.archive_contractor('30000000-0000-4000-8000-000000002103');
select public.restore_contractor('30000000-0000-4000-8000-000000002101');
select pg_temp.check(
  (select archived_at is null from public.contractors where id = '30000000-0000-4000-8000-000000002101'),
  'restore under the limit works');

-- As company B's owner ----------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000021b0", "role": "authenticated"}';
select pg_temp.must_fail($q$select public.archive_contractor('30000000-0000-4000-8000-000000002102')$q$,
  'SUBBIES_NOT_FOUND', 'cannot archive another company''s contractor');
select pg_temp.must_fail($q$select public.restore_contractor('30000000-0000-4000-8000-000000002103')$q$,
  'SUBBIES_NOT_FOUND', 'cannot restore another company''s contractor');

-- Anonymous ---------------------------------------------------------------------
reset role;
set local role anon;
select pg_temp.must_fail($q$select public.archive_contractor('30000000-0000-4000-8000-000000002102')$q$,
  'permission denied', 'anon cannot archive');

reset role;
select ' 0021 tests: all passed' as result;
rollback;
