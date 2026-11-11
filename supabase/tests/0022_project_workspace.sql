-- Subbies: tests for migration 0022 (project workspace)
-- ---------------------------------------------------------------------------
-- Run AFTER 0022. One transaction, rolled back at the end: it leaves no rows
-- behind. Prefer a local or staging copy of the database.
--
-- Success: the last line reads "0022 tests: all passed".
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

-- Fixtures: Business company A (two projects, one contractor on both),
-- Starter company S, and company B to try to reach across.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000022a0', 'a22@example.test'),
  ('00000000-0000-4000-8000-0000000022b0', 'b22@example.test'),
  ('00000000-0000-4000-8000-0000000022c0', 's22@example.test');
insert into public.companies (id, user_id, name) values
  ('10000000-0000-4000-8000-0000000022a0', '00000000-0000-4000-8000-0000000022a0', 'Company A'),
  ('10000000-0000-4000-8000-0000000022b0', '00000000-0000-4000-8000-0000000022b0', 'Company B'),
  ('10000000-0000-4000-8000-0000000022c0', '00000000-0000-4000-8000-0000000022c0', 'Company S');
insert into public.subscriptions (company_id, plan, status) values
  ('10000000-0000-4000-8000-0000000022a0', 'business', 'active'),
  ('10000000-0000-4000-8000-0000000022b0', 'business', 'active'),
  ('10000000-0000-4000-8000-0000000022c0', 'starter', 'active');
insert into public.document_types (id, company_id, name) values
  ('20000000-0000-4000-8000-0000000022a1', '10000000-0000-4000-8000-0000000022a0', 'Public liability'),
  ('20000000-0000-4000-8000-0000000022a2', '10000000-0000-4000-8000-0000000022a0', 'Workers comp'),
  ('20000000-0000-4000-8000-0000000022b1', '10000000-0000-4000-8000-0000000022b0', 'B type'),
  ('20000000-0000-4000-8000-0000000022c1', '10000000-0000-4000-8000-0000000022c0', 'S type');
insert into public.projects (id, company_id, name, status) values
  ('40000000-0000-4000-8000-0000000022a1', '10000000-0000-4000-8000-0000000022a0', 'Job A1', 'active'),
  ('40000000-0000-4000-8000-0000000022a2', '10000000-0000-4000-8000-0000000022a0', 'Job A2', 'active'),
  ('40000000-0000-4000-8000-0000000022b1', '10000000-0000-4000-8000-0000000022b0', 'Job B1', 'active'),
  ('40000000-0000-4000-8000-0000000022c1', '10000000-0000-4000-8000-0000000022c0', 'Job S1', 'active');
insert into public.contractors (id, company_id, business_name, email) values
  ('30000000-0000-4000-8000-0000000022a1', '10000000-0000-4000-8000-0000000022a0', 'Sparky Co', 'sp@example.test'),
  ('30000000-0000-4000-8000-0000000022b1', '10000000-0000-4000-8000-0000000022b0', 'B Sub', 'bs@example.test');
insert into public.project_contractors (project_id, contractor_id) values
  ('40000000-0000-4000-8000-0000000022a1', '30000000-0000-4000-8000-0000000022a1'),
  ('40000000-0000-4000-8000-0000000022a2', '30000000-0000-4000-8000-0000000022a1');
insert into public.contractor_documents (id, contractor_id, document_type_id, status, expiry_date) values
  ('50000000-0000-4000-8000-0000000022a1', '30000000-0000-4000-8000-0000000022a1', '20000000-0000-4000-8000-0000000022a1', 'approved', current_date - 1);

-- Plan feature gate --------------------------------------------------------------
select pg_temp.check(public.subbies_plan_has_feature('business', 'requirements'), 'business has requirements');
select pg_temp.check(not public.subbies_plan_has_feature('starter', 'requirements'), 'starter lacks requirements');
select pg_temp.check(public.subbies_plan_has_feature('starter', 'projectCompliance'), 'starter has project compliance');
select pg_temp.check(not public.subbies_plan_has_feature('business', 'analytics'), 'business lacks analytics');
select pg_temp.check(public.subbies_plan_has_feature('pro', 'analytics'), 'pro has analytics');
select pg_temp.check(not public.subbies_plan_has_feature(null, 'map'), 'no plan has nothing');
select pg_temp.check(not public.subbies_plan_has_feature('pro', 'nope'), 'unknown feature is no');

-- Composite FK: a requirement can't mix companies, even for the server.
select pg_temp.must_fail(
  $q$insert into public.project_requirements (company_id, project_id, document_type_id)
     values ('10000000-0000-4000-8000-0000000022a0', '40000000-0000-4000-8000-0000000022a1', '20000000-0000-4000-8000-0000000022b1')$q$,
  'violates foreign key', 'requirement cannot use another company''s document type');

-- As company A (Business) ---------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000022a0", "role": "authenticated"}';

select pg_temp.check(
  public.add_project_requirement('40000000-0000-4000-8000-0000000022a1', '20000000-0000-4000-8000-0000000022a1', true, null) is not null,
  'business can add a requirement');
select pg_temp.must_fail(
  $q$select public.add_project_requirement('40000000-0000-4000-8000-0000000022a1', '20000000-0000-4000-8000-0000000022a1', true, null)$q$,
  'SUBBIES_ALREADY_REQUIRED', 'duplicate requirement refused');
select pg_temp.must_fail(
  $q$select public.add_project_requirement('40000000-0000-4000-8000-0000000022a1', '20000000-0000-4000-8000-0000000022b1', true, null)$q$,
  'SUBBIES_NOT_FOUND', 'another company''s document type refused');
select pg_temp.must_fail(
  $q$select public.add_project_requirement('40000000-0000-4000-8000-0000000022b1', '20000000-0000-4000-8000-0000000022a1', true, null)$q$,
  'SUBBIES_NOT_FOUND', 'another company''s project refused');
select pg_temp.must_fail(
  $q$select public.add_project_requirement('40000000-0000-4000-8000-0000000022a1', '20000000-0000-4000-8000-0000000022a2', true, -1)$q$,
  'SUBBIES_INVALID_INPUT', 'negative min days refused');
select public.update_project_requirement(
  (select id from public.project_requirements where project_id = '40000000-0000-4000-8000-0000000022a1'), false, 30);
select pg_temp.check(
  (select not is_mandatory and min_days_valid = 30 from public.project_requirements where project_id = '40000000-0000-4000-8000-0000000022a1'),
  'requirement updated');
select pg_temp.must_fail(
  $q$insert into public.project_requirements (company_id, project_id, document_type_id) values ('10000000-0000-4000-8000-0000000022a0', '40000000-0000-4000-8000-0000000022a2', '20000000-0000-4000-8000-0000000022a2')$q$,
  'permission denied', 'no direct insert into requirements');
select pg_temp.check(
  (select count(*) from public.project_activity where event_type = 'requirement_added') = 1,
  'requirement_added recorded with a frozen sentence');
select pg_temp.check(
  (select description from public.project_activity where event_type = 'requirement_added') = 'Added requirement: Public liability (mandatory)',
  'requirement sentence');

-- Activity: write, fan out, can't rewrite.
select pg_temp.check(
  public.record_project_activity('40000000-0000-4000-8000-0000000022a1', 'project_updated', 'Edited project details') is not null,
  'record_project_activity works');
select pg_temp.must_fail(
  $q$select public.record_project_activity('40000000-0000-4000-8000-0000000022a1', 'document_expired', 'fake')$q$,
  'SUBBIES_INVALID_INPUT', 'system-only events refused from the client');
select pg_temp.must_fail(
  $q$select public.record_project_activity('40000000-0000-4000-8000-0000000022b1', 'project_updated', 'x')$q$,
  'SUBBIES_NOT_FOUND', 'cannot write to another company''s project');
select pg_temp.must_fail(
  $q$select public.record_project_activity('40000000-0000-4000-8000-0000000022a1', 'not_a_type', 'x')$q$,
  'violates check constraint', 'unknown event type refused');
select pg_temp.check(
  public.record_contractor_activity('30000000-0000-4000-8000-0000000022a1', 'document_approved', 'Approved Public liability for Sparky Co', '50000000-0000-4000-8000-0000000022a1') = 2,
  'contractor event fans out to both projects');
select pg_temp.must_fail(
  $q$update public.project_activity set description = 'rewritten'$q$,
  'permission denied', 'activity cannot be updated');
select pg_temp.must_fail(
  $q$delete from public.project_activity$q$,
  'permission denied', 'activity cannot be deleted');
select pg_temp.must_fail(
  $q$insert into public.project_activity (company_id, project_id, event_type, description) values ('10000000-0000-4000-8000-0000000022a0', '40000000-0000-4000-8000-0000000022a1', 'project_updated', 'x')$q$,
  'permission denied', 'no direct insert into activity');
select pg_temp.must_fail($q$select * from public.project_contractor_status$q$,
  'permission denied', 'status ledger is server-only');

-- Status sync: first sighting silent, real change once, repeat no-op.
select pg_temp.check(public.sync_project_statuses(
  '[{"project_id":"40000000-0000-4000-8000-0000000022a1","contractor_id":"30000000-0000-4000-8000-0000000022a1","status":"compliant"}]') = 0,
  'first sighting records nothing');
select pg_temp.check(public.sync_project_statuses(
  '[{"project_id":"40000000-0000-4000-8000-0000000022a1","contractor_id":"30000000-0000-4000-8000-0000000022a1","status":"not_cleared"}]') = 1,
  'a real change is recorded');
select pg_temp.check(public.sync_project_statuses(
  '[{"project_id":"40000000-0000-4000-8000-0000000022a1","contractor_id":"30000000-0000-4000-8000-0000000022a1","status":"not_cleared"}]') = 0,
  'the same status again records nothing');
select pg_temp.check(
  (select description from public.project_activity where event_type = 'compliance_status_changed') = 'Sparky Co: Compliant to not cleared',
  'status sentence');
select pg_temp.must_fail(
  $q$select public.sync_project_statuses('[{"project_id":"40000000-0000-4000-8000-0000000022b1","contractor_id":"30000000-0000-4000-8000-0000000022a1","status":"compliant"}]')$q$,
  'SUBBIES_NOT_FOUND', 'cannot sync another company''s project');
select pg_temp.must_fail(
  $q$select public.sync_project_statuses('[{"project_id":"40000000-0000-4000-8000-0000000022a1","contractor_id":"30000000-0000-4000-8000-0000000022a1","status":"great"}]')$q$,
  'SUBBIES_INVALID_INPUT', 'unknown status refused');

select public.remove_project_requirement(
  (select id from public.project_requirements where project_id = '40000000-0000-4000-8000-0000000022a1'));
select pg_temp.check(
  (select count(*) from public.project_activity where event_type = 'requirement_removed') = 1,
  'requirement_removed recorded');

-- As company B: sees none of A's rows.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000022b0", "role": "authenticated"}';
select pg_temp.check((select count(*) from public.project_activity) = 0, 'B cannot read A''s activity');
select pg_temp.check((select count(*) from public.project_requirements) = 0, 'B cannot read A''s requirements');

-- As company S (Starter): requirements are a Business feature.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000022c0", "role": "authenticated"}';
select pg_temp.must_fail(
  $q$select public.add_project_requirement('40000000-0000-4000-8000-0000000022c1', '20000000-0000-4000-8000-0000000022c1', true, null)$q$,
  'SUBBIES_FEATURE_NOT_IN_PLAN', 'starter cannot add requirements');

-- Anonymous.
reset role;
set local role anon;
select pg_temp.must_fail($q$select public.record_project_activity('40000000-0000-4000-8000-0000000022a1', 'project_updated', 'x')$q$,
  'permission denied', 'anon cannot record activity');
select pg_temp.must_fail($q$select count(*) from public.project_activity$q$,
  'permission denied', 'anon cannot read activity');

-- Service role (cron, token uploads) --------------------------------------------------
reset role;
set local role service_role;
select pg_temp.check(public.subbies_insert_project_activity(
  '10000000-0000-4000-8000-0000000022a0', '40000000-0000-4000-8000-0000000022a1', 'document_expired',
  'Public liability for Sparky Co expired', null, '30000000-0000-4000-8000-0000000022a1', '50000000-0000-4000-8000-0000000022a1', '{}') is not null,
  'cron records an expiry');
select pg_temp.check(public.subbies_insert_project_activity(
  '10000000-0000-4000-8000-0000000022a0', '40000000-0000-4000-8000-0000000022a1', 'document_expired',
  'Public liability for Sparky Co expired', null, '30000000-0000-4000-8000-0000000022a1', '50000000-0000-4000-8000-0000000022a1', '{}') is null,
  'the same expiry again is a no-op');
select pg_temp.must_fail(
  $q$select public.subbies_insert_project_activity('10000000-0000-4000-8000-0000000022b0', '40000000-0000-4000-8000-0000000022a1', 'project_updated', 'x', null, null, null, '{}')$q$,
  'SUBBIES_NOT_FOUND', 'server insert still checks the company');
select pg_temp.must_fail($q$delete from public.project_activity$q$,
  'permission denied', 'server cannot delete activity either');

-- Deleting things -------------------------------------------------------------------------
reset role;
insert into public.project_requirements (company_id, project_id, document_type_id)
values ('10000000-0000-4000-8000-0000000022a0', '40000000-0000-4000-8000-0000000022a2', '20000000-0000-4000-8000-0000000022a2');
select pg_temp.must_fail(
  $q$delete from public.document_types where id = '20000000-0000-4000-8000-0000000022a2'$q$,
  'violates foreign key', 'a document type in use by a project cannot be deleted');
-- (The contractor document is removed first: how contractor_documents ->
-- document_types behaves on delete predates this migration and isn't under test.)
delete from public.contractor_documents where id = '50000000-0000-4000-8000-0000000022a1';
delete from auth.users where id = '00000000-0000-4000-8000-0000000022a0';
select pg_temp.check(
  not exists (select 1 from public.project_requirements where company_id = '10000000-0000-4000-8000-0000000022a0')
  and not exists (select 1 from public.project_activity where company_id = '10000000-0000-4000-8000-0000000022a0'),
  'deleting the account cascades through requirements and activity');

select ' 0022 tests: all passed' as result;
rollback;
