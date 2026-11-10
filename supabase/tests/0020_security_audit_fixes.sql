-- Subbies — tests for migration 0020 (both parts)
-- ---------------------------------------------------------------------------
-- Run AFTER Part B. Everything happens inside one transaction that is rolled
-- back at the end, so it leaves no rows behind. It creates two throwaway
-- users and companies to test against. Intended for a local or staging copy
-- of the database; on production it is still rolled back, but prefer staging.
--
-- Success: the last line reads "0020 tests: all passed". Any failure stops
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

-- Runs a statement that must fail, and checks the error text contains `expected`.
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

-- Fixtures: a paid Starter company (A) and a company with no plan (B).
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'b@example.test');
insert into public.companies (id, user_id, name) values
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'Company A'),
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', 'Company B');
insert into public.subscriptions (company_id, plan, status) values
  ('10000000-0000-4000-8000-00000000000a', 'starter', 'active'),
  ('10000000-0000-4000-8000-00000000000b', null, 'none');
insert into public.document_types (id, company_id, name) values
  ('20000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000a', 'Insurance A'),
  ('20000000-0000-4000-8000-00000000000b', '10000000-0000-4000-8000-00000000000b', 'Insurance B');

-- Plan limits as the database sees them --------------------------------------
select pg_temp.check(public.subbies_plan_limit('starter', 'contractors') = 5, 'starter contractors = 5');
select pg_temp.check(public.subbies_plan_limit('starter', 'projects') = 0, 'starter projects = 0');
select pg_temp.check(public.subbies_plan_limit('business', 'projects') = 10, 'business projects = 10');
select pg_temp.check(public.subbies_plan_limit('pro', 'contractors') is null, 'pro contractors unlimited');
select pg_temp.check(public.subbies_plan_limit(null, 'contractors') = 0, 'no plan = 0');
select pg_temp.check(public.subbies_plan_limit('mystery', 'contractors') = 0, 'unknown plan = 0');

-- As company A (signed in) ------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000a", "role": "authenticated"}';

select pg_temp.must_fail(
  $q$insert into public.contractors (company_id, business_name, email) values ('10000000-0000-4000-8000-00000000000a', 'Direct', 'x@example.test')$q$,
  'permission denied', 'direct insert into contractors is refused');

select pg_temp.check(
  (select count(*) from generate_series(1, 5) n,
     lateral public.create_contractor('Sub ' || n, null, 'sub' || n || '@example.test', null, null,
       array['20000000-0000-4000-8000-00000000000a']::uuid[])) = 5,
  'normal path: a paid Starter company can add 5 contractors through create_contractor');

select pg_temp.must_fail(
  $q$select public.create_contractor('Sixth', null, 'six@example.test', null, null, array['20000000-0000-4000-8000-00000000000a']::uuid[])$q$,
  'SUBBIES_LIMIT_REACHED', 'the 6th contractor on Starter is refused');

select pg_temp.must_fail(
  $q$select public.create_project('Job', null, 'active', null, null)$q$,
  'SUBBIES_LIMIT_REACHED', 'Starter cannot create a project');

select pg_temp.must_fail(
  $q$select public.create_contractor('Sneaky', null, 'sneak@example.test', null, null, array['20000000-0000-4000-8000-00000000000b']::uuid[])$q$,
  'SUBBIES_UNKNOWN_DOCUMENT_TYPE', 'another company''s document type is refused');

select pg_temp.check(
  public.create_document_type('Licence', 12, array[30, 14, 7]) is not null,
  'normal path: create_document_type works');

select pg_temp.check((select count(*) from public.contractor_tokens) = 5, 'owner can read own tokens');
select pg_temp.must_fail(
  $q$update public.contractor_tokens set expires_at = now() + interval '10 years'$q$,
  'permission denied', 'owner cannot extend a link directly');
select pg_temp.must_fail(
  $q$update public.contractor_tokens set last_request_sent_at = null$q$,
  'permission denied', 'owner cannot reset the old cooldown column');

update public.contractors set business_name = 'Renamed' where business_name = 'Sub 1';
select pg_temp.check(
  (select count(*) from public.contractors where business_name = 'Renamed') = 1,
  'normal path: owner can edit contractor details');
select pg_temp.must_fail(
  $q$update public.contractors set company_id = '10000000-0000-4000-8000-00000000000b'$q$,
  'permission denied', 'owner cannot move a contractor to another company');

update public.contractor_documents set status = 'uploaded';
select pg_temp.check(
  (select count(*) from public.contractor_documents where status = 'uploaded') = 5,
  'normal path: owner can change document status');
select pg_temp.must_fail(
  $q$update public.contractor_documents set document_type_id = '20000000-0000-4000-8000-00000000000b'$q$,
  'permission denied', 'owner cannot retype a document');

select pg_temp.check((select count(*) from public.contractors where company_id = '10000000-0000-4000-8000-00000000000b') = 0,
  'A cannot see B''s contractors');

select pg_temp.must_fail($q$select public.claim_email_send('10000000-0000-4000-8000-00000000000a', 't', 1, 60)$q$,
  'permission denied', 'signed-in users cannot call claim_email_send');
select pg_temp.must_fail($q$select public.claim_request_cooldown('10000000-0000-4000-8000-00000000000a', 60)$q$,
  'permission denied', 'signed-in users cannot call claim_request_cooldown');
select pg_temp.must_fail($q$select * from public.email_send_log$q$,
  'permission denied', 'signed-in users cannot read email_send_log');

-- As company B (no plan) ----------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-00000000000b", "role": "authenticated"}';
select pg_temp.must_fail(
  $q$select public.create_contractor('Spam', null, 'victim@example.test', null, null, array['20000000-0000-4000-8000-00000000000b']::uuid[])$q$,
  'SUBBIES_NO_ACCESS', 'a company with no plan cannot add contractors');
select pg_temp.must_fail(
  $q$select public.create_document_type('X', 12, '{}')$q$,
  'SUBBIES_NO_ACCESS', 'a company with no plan cannot add document types');

-- Anonymous ---------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select pg_temp.must_fail(
  $q$select public.create_contractor('Anon', null, 'anon@example.test', null, null, '{}')$q$,
  'permission denied', 'anon cannot call create_contractor');

-- Server-side functions (service role) -----------------------------------------------
reset role;
set local role service_role;

select pg_temp.check(
  public.claim_request_cooldown((select id from public.contractors where business_name = 'Sub 2'), 300),
  'first resend claims the cooldown');
select pg_temp.check(
  not public.claim_request_cooldown((select id from public.contractors where business_name = 'Sub 2'), 300),
  'second resend inside 5 minutes is refused');
select public.release_request_cooldown((select id from public.contractors where business_name = 'Sub 2'));
select pg_temp.check(
  public.claim_request_cooldown((select id from public.contractors where business_name = 'Sub 2'), 300),
  'a released slot can be claimed again');

select pg_temp.check(
  (select count(*) from generate_series(1, 4) n
    where public.claim_email_send('10000000-0000-4000-8000-00000000000a', 'test', 3 + 0 * n, 86400) is not null) = 3,
  'email cap: 3 of 4 sends allowed with a cap of 3');

insert into public.account_deletion_codes (user_id, code_hash, expires_at)
values ('00000000-0000-4000-8000-00000000000a', 'hash', now() + interval '10 minutes');
select pg_temp.check(
  (select count(*) from generate_series(1, 8) n, lateral public.consume_deletion_code_attempt('00000000-0000-4000-8000-00000000000a', 5 + 0 * n)) = 5,
  'deletion code: only 5 attempts are handed out');
select pg_temp.check(
  (select attempts from public.account_deletion_codes where user_id = '00000000-0000-4000-8000-00000000000a') = 5,
  'deletion code: counter stops at 5');

select pg_temp.check(public.claim_trial_fingerprint('fp_1', '10000000-0000-4000-8000-00000000000a'), 'new card gets a trial');
select pg_temp.check(public.claim_trial_fingerprint('fp_1', '10000000-0000-4000-8000-00000000000a'), 'same company retry keeps its trial');
select pg_temp.check(not public.claim_trial_fingerprint('fp_1', '10000000-0000-4000-8000-00000000000b'), 'same card, other company: no trial');

select pg_temp.check(public.check_rate_limit('t', 'k', 2, 60), 'rate limit hit 1');
select pg_temp.check(public.check_rate_limit('t', 'k', 2, 60), 'rate limit hit 2');
select pg_temp.check(not public.check_rate_limit('t', 'k', 2, 60), 'rate limit hit 3 refused');

reset role;
select ' 0020 tests: all passed' as result;
rollback;
