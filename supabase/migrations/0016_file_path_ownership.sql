-- Subbies — storage paths must sit inside the owning company's folder (C1)
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0015. Additive only: two functions and
-- two triggers. No table, column, policy or existing row is changed. Safe to
-- re-run.
--
-- Why: every stored document lives at
--   {company_id}/{contractor_id}/{document_id}/{uuid}.{ext}
-- and the server signs/deletes those paths with the service role, which
-- ignores storage permissions. The RLS policy on contractor_document_files
-- (0011) only checks that the *document row* belongs to the caller's company;
-- it never looked at file_path. So a company could save a file row, under its
-- own document, whose path pointed at ANOTHER company's file, and then have
-- the server sign it for them. The app now refuses to act on such paths; this
-- migration stops them being written in the first place.
--
-- Why a trigger rather than tightening the RLS policy: RLS does not apply to
-- the service role, and the app writes these rows with the service role (the
-- contractor upload flow). A BEFORE trigger runs for every writer, service
-- role included, so it is the one guard nothing can go around.
--
-- Existing rows are NOT touched or re-checked. Run
-- supabase/diagnostics/check-file-path-mismatches.sql to see whether any
-- existing row already breaks the rule.
-- ---------------------------------------------------------------------------

-- 1. The rule, as one pure predicate ------------------------------------------
-- Mirrors lib/storage-path-ownership.ts (isPathOwnedByCompany): the first
-- segment must be exactly the company id, something must follow it, and no
-- empty/"."/".." segments, leading "/", backslashes, "%" encodings or control
-- characters are allowed. Immutable and side-effect free.
create or replace function public.is_company_storage_path(p_path text, p_company uuid)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    p_path is not null
    and p_company is not null
    and char_length(p_path) between 38 and 1024
    and left(p_path, 37) = p_company::text || '/'
    and position(E'\\' in p_path) = 0
    and position('%' in p_path) = 0
    and p_path !~ '[[:cntrl:]]'
    and p_path !~ '//'
    and p_path !~ '(^|/)\.\.?(/|$)'
    and right(p_path, 1) <> '/';
$$;

-- 2. contractor_document_files.file_path ---------------------------------------
-- security definer + fixed search_path so the owner lookup sees the document
-- whoever is writing (an authenticated user only ever reaches this for a
-- document RLS already let them write, so nothing extra is exposed).
create or replace function public.enforce_document_file_path_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_company uuid;
begin
  select c.company_id
    into owner_company
    from public.contractor_documents cd
    join public.contractors c on c.id = cd.contractor_id
   where cd.id = new.contractor_document_id;

  if owner_company is null
     or not public.is_company_storage_path(new.file_path, owner_company) then
    raise exception 'file_path must be inside the owning company''s storage folder'
      using errcode = '23514'; -- check_violation
  end if;

  return new;
end;
$$;

drop trigger if exists contractor_document_files_path_owner on public.contractor_document_files;
create trigger contractor_document_files_path_owner
  before insert or update of file_path, contractor_document_id
  on public.contractor_document_files
  for each row
  execute function public.enforce_document_file_path_owner();

-- 3. contractor_documents.file_url (legacy mirror of the first file) ----------
-- Still written by the contractor submit flow and read when a document is
-- deleted, so it gets the same rule. Only checked when it is set or changed
-- (or the row moves contractor), so an update to some other column on an old
-- row is never blocked by that row's history. NULL is always allowed.
create or replace function public.enforce_document_file_url_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_company uuid;
begin
  if new.file_url is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.file_url is not distinct from old.file_url
     and new.contractor_id is not distinct from old.contractor_id then
    return new;
  end if;

  select c.company_id
    into owner_company
    from public.contractors c
   where c.id = new.contractor_id;

  if owner_company is null
     or not public.is_company_storage_path(new.file_url, owner_company) then
    raise exception 'file_url must be inside the owning company''s storage folder'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists contractor_documents_file_url_owner on public.contractor_documents;
create trigger contractor_documents_file_url_owner
  before insert or update of file_url, contractor_id
  on public.contractor_documents
  for each row
  execute function public.enforce_document_file_url_owner();

-- The trigger functions are only ever run by their triggers.
revoke all on function public.enforce_document_file_path_owner() from public, anon, authenticated;
revoke all on function public.enforce_document_file_url_owner() from public, anon, authenticated;
