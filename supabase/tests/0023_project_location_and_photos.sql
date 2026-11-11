-- Subbies: tests for migration 0023 (project location and photos)
-- ---------------------------------------------------------------------------
-- Run AFTER 0023. One transaction, rolled back at the end.
-- Success: the last line reads "0023 tests: all passed".
-- (The race test, many parallel uploads, lives outside a transaction; see
-- docs/upgrade/MIGRATIONS.md.)
-- ---------------------------------------------------------------------------
\set ON_ERROR_STOP on
begin;

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
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

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000023a0', 'a23@example.test'),
  ('00000000-0000-4000-8000-0000000023b0', 'b23@example.test');
insert into public.companies (id, user_id, name) values
  ('10000000-0000-4000-8000-0000000023a0', '00000000-0000-4000-8000-0000000023a0', 'Company A'),
  ('10000000-0000-4000-8000-0000000023b0', '00000000-0000-4000-8000-0000000023b0', 'Company B');
insert into public.subscriptions (company_id, plan, status) values
  ('10000000-0000-4000-8000-0000000023a0', 'starter', 'active'),
  ('10000000-0000-4000-8000-0000000023b0', 'starter', 'active');
insert into public.projects (id, company_id, name, status) values
  ('40000000-0000-4000-8000-0000000023a1', '10000000-0000-4000-8000-0000000023a0', 'Job A', 'active'),
  ('40000000-0000-4000-8000-0000000023b1', '10000000-0000-4000-8000-0000000023b0', 'Job B', 'active');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000023a0", "role": "authenticated"}';

-- Location ------------------------------------------------------------------------
select public.set_project_location('40000000-0000-4000-8000-0000000023a1', '12 Goodwin Tce, Burleigh Heads QLD', -28.0889123, 153.4512345, 'abc', false);
select pg_temp.check(
  (select latitude = -28.088912 and longitude = 153.451235 and location_address = '12 Goodwin Tce, Burleigh Heads QLD' and not location_is_manual
     from public.projects where id = '40000000-0000-4000-8000-0000000023a1'),
  'location saved, rounded to 6 places');
select pg_temp.must_fail(
  $q$select public.set_project_location('40000000-0000-4000-8000-0000000023a1', 'x', -91, 150, null, true)$q$,
  'SUBBIES_INVALID_INPUT', 'latitude out of range refused');
select pg_temp.must_fail(
  $q$select public.set_project_location('40000000-0000-4000-8000-0000000023a1', 'x', null, 150, null, true)$q$,
  'SUBBIES_INVALID_INPUT', 'half a coordinate refused');
select pg_temp.must_fail(
  $q$select public.set_project_location('40000000-0000-4000-8000-0000000023b1', 'x', -27, 153, null, true)$q$,
  'SUBBIES_NOT_FOUND', 'cannot set another company''s location');
select pg_temp.must_fail(
  $q$update public.projects set latitude = 1, longitude = 1 where id = '40000000-0000-4000-8000-0000000023a1'$q$,
  'permission denied', 'location columns not directly writable');
select pg_temp.check(
  (select count(*) from public.project_activity where event_type = 'location_changed') = 1,
  'location_changed recorded');
select public.clear_project_location('40000000-0000-4000-8000-0000000023a1');
select pg_temp.check(
  (select latitude is null and location_address is null from public.projects where id = '40000000-0000-4000-8000-0000000023a1'),
  'location removed');

-- Photos ----------------------------------------------------------------------------
select pg_temp.check((select slot from public.add_project_photo('40000000-0000-4000-8000-0000000023a1',
  '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p1.webp',
  '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p1-thumb.webp', 'one.jpg', 1000)) = 1, 'first photo takes slot 1');
select pg_temp.check((select slot from public.add_project_photo('40000000-0000-4000-8000-0000000023a1',
  '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p2.webp',
  '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p2-thumb.webp', 'two.jpg', 1000)) = 2, 'second photo takes slot 2');
select pg_temp.check((select slot from public.add_project_photo('40000000-0000-4000-8000-0000000023a1',
  '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p3.webp',
  '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p3-thumb.webp', 'three.jpg', 1000)) = 3, 'third photo takes slot 3');
select pg_temp.must_fail(
  $q$select * from public.add_project_photo('40000000-0000-4000-8000-0000000023a1',
    '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p4.webp',
    '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p4-thumb.webp', 'four.jpg', 1000)$q$,
  'SUBBIES_PHOTO_LIMIT', 'a fourth photo is refused');
select pg_temp.must_fail(
  $q$select * from public.add_project_photo('40000000-0000-4000-8000-0000000023a1',
    '10000000-0000-4000-8000-0000000023b0/40000000-0000-4000-8000-0000000023a1/x.webp',
    '10000000-0000-4000-8000-0000000023b0/40000000-0000-4000-8000-0000000023a1/x-thumb.webp', 'x.jpg', 1000)$q$,
  'SUBBIES_PHOTO_LIMIT', 'still full (path check runs on insert)');

-- Move: slot 1 right swaps with slot 2.
select public.move_project_photo((select id from public.project_photos where original_filename = 'one.jpg'), 1);
select pg_temp.check(
  (select string_agg(original_filename, ',' order by position) from public.project_photos where project_id = '40000000-0000-4000-8000-0000000023a1') = 'two.jpg,one.jpg,three.jpg',
  'move swaps two slots in one statement');
select public.move_project_photo((select id from public.project_photos where original_filename = 'two.jpg'), -1);
select pg_temp.check(
  (select position from public.project_photos where original_filename = 'two.jpg') = 1,
  'moving past the first slot does nothing');

-- Delete, then the freed slot is reused.
select pg_temp.check(
  (select old_storage_path from public.delete_project_photo((select id from public.project_photos where original_filename = 'one.jpg')))
    = '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p1.webp',
  'delete returns the paths to remove');
select pg_temp.check((select slot from public.add_project_photo('40000000-0000-4000-8000-0000000023a1',
  '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p5.webp',
  '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p5-thumb.webp', 'five.jpg', 1000)) = 2, 'freed slot is reused');

select pg_temp.check(
  (select old_storage_path from public.replace_project_photo((select id from public.project_photos where original_filename = 'five.jpg'),
     '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p6.webp',
     '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p6-thumb.webp', 'six.jpg', 2000))
    = '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/p5.webp',
  'replace returns the old paths');
select pg_temp.check(
  (select count(*) from public.project_activity where event_type in ('photo_added', 'photo_removed', 'photo_replaced')) = 6,
  'photo events recorded');
select pg_temp.must_fail(
  $q$insert into public.project_photos (company_id, project_id, position, storage_path, thumb_path, size_bytes)
     values ('10000000-0000-4000-8000-0000000023a0', '40000000-0000-4000-8000-0000000023a1', 3, 'a', 'b', 1)$q$,
  'permission denied', 'no direct insert into photos');

-- Storage policies: own folder yes, another company's folder no.
insert into storage.objects (bucket_id, name) values ('project-photos', '10000000-0000-4000-8000-0000000023a0/40000000-0000-4000-8000-0000000023a1/ok.webp');
select pg_temp.must_fail(
  $q$insert into storage.objects (bucket_id, name) values ('project-photos', '10000000-0000-4000-8000-0000000023b0/40000000-0000-4000-8000-0000000023b1/nope.webp')$q$,
  'row-level security', 'cannot upload into another company''s folder');

-- As company B.
set local request.jwt.claims = '{"sub": "00000000-0000-4000-8000-0000000023b0", "role": "authenticated"}';
select pg_temp.check((select count(*) from public.project_photos) = 0, 'B cannot see A''s photos');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'project-photos') = 0, 'B cannot see A''s photo files');
select pg_temp.must_fail(
  $q$select * from public.delete_project_photo((select id from public.project_photos limit 1))$q$,
  'SUBBIES_NOT_FOUND', 'B cannot delete A''s photo');

reset role;
select pg_temp.check((select public = false from storage.buckets where id = 'project-photos'), 'bucket is private');

select ' 0023 tests: all passed' as result;
rollback;
