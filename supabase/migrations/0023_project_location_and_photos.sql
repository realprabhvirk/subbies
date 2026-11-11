-- 0023: project location and jobsite photos (upgrade Phase 3)
--
-- Additive and idempotent. Safe to apply before the Phase 3 code ships: new
-- nullable columns, a new table, a new private bucket and new functions. The
-- deployed code never reads any of them, and the projects column grant is
-- unchanged (location is only written through set/clear_project_location).
--
-- 1. projects: optional map location (address, lat/lng, place id, manual flag).
-- 2. set_project_location / clear_project_location (record location_changed).
-- 3. project_photos: max 3 per project, enforced by unique (project_id, position)
--    and a 1..3 check, so a fourth upload fails in the database even when
--    requests race. Deferrable so a reorder can swap two slots in one statement.
-- 4. Photo functions: add (takes the lowest free slot), replace, delete, move.
-- 5. Private bucket project-photos with Storage policies scoped to the
--    caller's company by the first path segment ({company_id}/{project_id}/...).
--
-- Requires 0020 (subbies_caller_company) and 0022 (subbies_insert_project_activity).
-- Rollback: see docs/upgrade/MIGRATIONS.md.


-- 0. Prerequisites ------------------------------------------------------------
-- 0023 builds on 0022 (activity log, composite keys). Stop with a plain
-- message rather than a cryptic foreign-key error if it hasn't been applied.
do $$
begin
  if to_regprocedure('public.subbies_insert_project_activity(uuid,uuid,text,text,uuid,uuid,uuid,jsonb)') is null then
    raise exception 'Migration 0022 (project workspace) has not been applied to this database. Run 0022 first, then 0023.';
  end if;
end $$;

-- The key project_photos points at (also created by 0022; harmless if present).
create unique index if not exists projects_id_company_uniq on public.projects (id, company_id);


-- 1. Location columns ----------------------------------------------------------
alter table public.projects add column if not exists location_address text;
alter table public.projects add column if not exists latitude numeric(9,6);
alter table public.projects add column if not exists longitude numeric(9,6);
alter table public.projects add column if not exists location_place_id text;
alter table public.projects add column if not exists location_is_manual boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_latitude_range') then
    alter table public.projects add constraint projects_latitude_range check (latitude is null or latitude between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_longitude_range') then
    alter table public.projects add constraint projects_longitude_range check (longitude is null or longitude between -180 and 180);
  end if;
  -- Both coordinates or neither.
  if not exists (select 1 from pg_constraint where conname = 'projects_coordinates_pair') then
    alter table public.projects add constraint projects_coordinates_pair check ((latitude is null) = (longitude is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_location_text_len') then
    alter table public.projects add constraint projects_location_text_len
      check (char_length(coalesce(location_address, '')) <= 300 and char_length(coalesce(location_place_id, '')) <= 300);
  end if;
end $$;


-- 2. Location functions --------------------------------------------------------------
create or replace function public.set_project_location(
  p_project_id uuid,
  p_address text,
  p_latitude numeric,
  p_longitude numeric,
  p_place_id text,
  p_is_manual boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid := public.subbies_caller_company();
  had_location boolean;
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;
  if not public.subbies_company_has_access(company) then
    raise exception 'SUBBIES_NO_ACCESS' using errcode = 'P0001';
  end if;
  p_address := nullif(btrim(coalesce(p_address, '')), '');
  p_place_id := nullif(btrim(coalesce(p_place_id, '')), '');
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
     or char_length(coalesce(p_address, '')) > 300 or char_length(coalesce(p_place_id, '')) > 300 then
    raise exception 'SUBBIES_INVALID_INPUT' using errcode = 'P0001';
  end if;

  select p.latitude is not null into had_location
    from public.projects p where p.id = p_project_id and p.company_id = company;
  if not found then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.projects
     set location_address = p_address,
         latitude = round(p_latitude, 6),
         longitude = round(p_longitude, 6),
         location_place_id = p_place_id,
         location_is_manual = coalesce(p_is_manual, false)
   where id = p_project_id and company_id = company;

  perform public.subbies_insert_project_activity(
    company, p_project_id, 'location_changed',
    case when had_location then 'Moved the map location' else 'Added a map location' end
      || coalesce(' to ' || p_address, ''),
    auth.uid(), null, null,
    jsonb_build_object('manual', coalesce(p_is_manual, false)));
end;
$$;

create or replace function public.clear_project_location(p_project_id uuid)
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
  update public.projects
     set location_address = null, latitude = null, longitude = null,
         location_place_id = null, location_is_manual = false
   where id = p_project_id and company_id = company;
  if not found then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.subbies_insert_project_activity(
    company, p_project_id, 'location_changed', 'Removed the map location', auth.uid(), null, null, '{}'::jsonb);
end;
$$;


-- 3. Photos table --------------------------------------------------------------------------
create table if not exists public.project_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  -- PHOTO_SLOTS: 3 (must match PLAN_CONFIG photos in lib/billing/plans.ts)
  position smallint not null check (position between 1 and 3),
  storage_path text not null check (char_length(storage_path) <= 300),
  thumb_path text not null check (char_length(thumb_path) <= 300),
  original_filename text null check (char_length(coalesce(original_filename, '')) <= 255),
  mime_type text not null default 'image/webp' check (mime_type = 'image/webp'),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  uploaded_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint project_photos_project_fk
    foreign key (project_id, company_id) references public.projects (id, company_id) on delete cascade,
  constraint project_photos_slot_uniq unique (project_id, position) deferrable initially immediate,
  -- Files live under the owning company's folder.
  constraint project_photos_path_scope check (
    storage_path like company_id::text || '/' || project_id::text || '/%'
    and thumb_path like company_id::text || '/' || project_id::text || '/%'
  )
);
create index if not exists project_photos_company_idx on public.project_photos (company_id);
alter table public.project_photos enable row level security;

drop policy if exists "own company project_photos select" on public.project_photos;
create policy "own company project_photos select" on public.project_photos
  for select to authenticated
  using (company_id in (select c.id from public.companies c where c.user_id = (select auth.uid())));


-- 4. Photo functions -------------------------------------------------------------------------
-- Takes the lowest free slot. If a concurrent upload took it first, the
-- unique constraint refuses and this tries the next; when none is left it
-- raises SUBBIES_PHOTO_LIMIT.
create or replace function public.add_project_photo(
  p_project_id uuid,
  p_storage_path text,
  p_thumb_path text,
  p_original_filename text,
  p_size_bytes integer
)
returns table (photo_id uuid, slot smallint)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  company uuid := public.subbies_caller_company();
  s smallint;
  new_id uuid;
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;
  if not public.subbies_company_has_access(company) then
    raise exception 'SUBBIES_NO_ACCESS' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.projects p where p.id = p_project_id and p.company_id = company) then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;

  for s in 1..3 loop
    continue when exists (select 1 from public.project_photos x where x.project_id = p_project_id and x.position = s);
    begin
      insert into public.project_photos
        (company_id, project_id, position, storage_path, thumb_path, original_filename, size_bytes, uploaded_by)
      values
        (company, p_project_id, s, p_storage_path, p_thumb_path, left(p_original_filename, 255), p_size_bytes, auth.uid())
      returning id into new_id;
      perform public.subbies_insert_project_activity(
        company, p_project_id, 'photo_added', 'Added a jobsite photo', auth.uid(), null, null,
        jsonb_build_object('photo_id', new_id, 'position', s));
      return query select new_id, s::smallint;
      return;
    exception when unique_violation then
      -- Taken by a concurrent upload: try the next slot.
    end;
  end loop;
  raise exception 'SUBBIES_PHOTO_LIMIT' using errcode = 'P0001';
end;
$$;

-- Swaps the files in a slot. Returns the old paths for the caller to delete.
create or replace function public.replace_project_photo(
  p_photo_id uuid,
  p_storage_path text,
  p_thumb_path text,
  p_original_filename text,
  p_size_bytes integer
)
returns table (old_storage_path text, old_thumb_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid := public.subbies_caller_company();
  old record;
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;
  if not public.subbies_company_has_access(company) then
    raise exception 'SUBBIES_NO_ACCESS' using errcode = 'P0001';
  end if;
  select ph.id, ph.project_id, ph.storage_path, ph.thumb_path into old
    from public.project_photos ph
   where ph.id = p_photo_id and ph.company_id = company
     for update;
  if old.id is null then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;
  update public.project_photos
     set storage_path = p_storage_path, thumb_path = p_thumb_path,
         original_filename = left(p_original_filename, 255), size_bytes = p_size_bytes,
         uploaded_by = auth.uid(), created_at = now()
   where id = p_photo_id;
  perform public.subbies_insert_project_activity(
    company, old.project_id, 'photo_replaced', 'Replaced a jobsite photo', auth.uid(), null, null,
    jsonb_build_object('photo_id', p_photo_id));
  return query select old.storage_path, old.thumb_path;
end;
$$;

-- Removes the row (the caller then deletes the files best-effort; the nightly
-- sweep catches anything left). Returns the paths.
create or replace function public.delete_project_photo(p_photo_id uuid)
returns table (old_storage_path text, old_thumb_path text)
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
  delete from public.project_photos ph
   where ph.id = p_photo_id and ph.company_id = company
  returning ph.project_id, ph.storage_path, ph.thumb_path into gone;
  if gone.project_id is null then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;
  perform public.subbies_insert_project_activity(
    company, gone.project_id, 'photo_removed', 'Removed a jobsite photo', auth.uid(), null, null,
    jsonb_build_object('photo_id', p_photo_id));
  return query select gone.storage_path, gone.thumb_path;
end;
$$;

-- Moves a photo one slot left (-1) or right (+1): swaps with the photo there
-- in one statement (the deferrable constraint allows the swap), or just moves
-- into the empty slot.
create or replace function public.move_project_photo(p_photo_id uuid, p_direction integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  company uuid := public.subbies_caller_company();
  me record;
  target smallint;
  other uuid;
begin
  if company is null then
    raise exception 'SUBBIES_NO_COMPANY' using errcode = 'P0001';
  end if;
  if p_direction not in (-1, 1) then
    raise exception 'SUBBIES_INVALID_INPUT' using errcode = 'P0001';
  end if;
  select ph.id, ph.project_id, ph.position into me
    from public.project_photos ph
   where ph.id = p_photo_id and ph.company_id = company
     for update;
  if me.id is null then
    raise exception 'SUBBIES_NOT_FOUND' using errcode = 'P0001';
  end if;
  target := me.position + p_direction;
  if target < 1 or target > 3 then
    return;
  end if;
  select ph.id into other from public.project_photos ph
   where ph.project_id = me.project_id and ph.position = target
     for update;

  set constraints public.project_photos_slot_uniq deferred;
  if other is null then
    update public.project_photos set position = target where id = me.id;
  else
    update public.project_photos
       set position = case when id = me.id then target else me.position end
     where id in (me.id, other);
  end if;
end;
$$;


-- 5. Storage ----------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-photos', 'project-photos', false, 5242880, array['image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Signed-in users can only touch objects under their own company's folder.
drop policy if exists "project photos own company read" on storage.objects;
create policy "project photos own company read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'project-photos'
    and (storage.foldername(name))[1] in (select c.id::text from public.companies c where c.user_id = (select auth.uid()))
  );

drop policy if exists "project photos own company insert" on storage.objects;
create policy "project photos own company insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'project-photos'
    and (storage.foldername(name))[1] in (select c.id::text from public.companies c where c.user_id = (select auth.uid()))
  );

drop policy if exists "project photos own company delete" on storage.objects;
create policy "project photos own company delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'project-photos'
    and (storage.foldername(name))[1] in (select c.id::text from public.companies c where c.user_id = (select auth.uid()))
  );


-- Grants --------------------------------------------------------------------------------------
revoke insert, update, delete on table public.project_photos from anon, authenticated;
revoke select on table public.project_photos from anon;
grant select on table public.project_photos to authenticated;

revoke all on function public.set_project_location(uuid, text, numeric, numeric, text, boolean) from public, anon;
revoke all on function public.clear_project_location(uuid) from public, anon;
revoke all on function public.add_project_photo(uuid, text, text, text, integer) from public, anon;
revoke all on function public.replace_project_photo(uuid, text, text, text, integer) from public, anon;
revoke all on function public.delete_project_photo(uuid) from public, anon;
revoke all on function public.move_project_photo(uuid, integer) from public, anon;
grant execute on function public.set_project_location(uuid, text, numeric, numeric, text, boolean) to authenticated;
grant execute on function public.clear_project_location(uuid) to authenticated;
grant execute on function public.add_project_photo(uuid, text, text, text, integer) to authenticated;
grant execute on function public.replace_project_photo(uuid, text, text, text, integer) to authenticated;
grant execute on function public.delete_project_photo(uuid) to authenticated;
grant execute on function public.move_project_photo(uuid, integer) to authenticated;
