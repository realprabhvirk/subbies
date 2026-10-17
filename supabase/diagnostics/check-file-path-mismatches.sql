-- Subbies — diagnostic (READ-ONLY): stored file paths outside their company's folder
-- ---------------------------------------------------------------------------
-- Paste into the Supabase SQL editor and run. It only SELECTs: nothing is
-- changed, and it is safe to run as often as you like, before or after
-- migration 0016.
--
-- Every document file should live at {company_id}/{contractor_id}/{document_id}/...
-- Any row returned below points somewhere else. Expected result on a healthy
-- project: two empty results ("No rows returned").
--
-- If anything comes back, don't delete it — send the result to Claude first.
-- The `owner_company_id` / `path_company_segment` columns show whose folder
-- the row should point into vs. whose folder it actually points into.
-- ---------------------------------------------------------------------------

-- 1. contractor_document_files.file_path (the files the dashboard shows) ------
select
  'contractor_document_files' as source,
  f.id                         as row_id,
  f.contractor_document_id     as document_id,
  c.company_id                 as owner_company_id,
  split_part(f.file_path, '/', 1) as path_company_segment,
  f.file_path,
  f.created_at
from public.contractor_document_files f
join public.contractor_documents cd on cd.id = f.contractor_document_id
join public.contractors c on c.id = cd.contractor_id
where f.file_path is null
   or left(f.file_path, 37) <> c.company_id::text || '/'
   or char_length(f.file_path) < 38
   or position(E'\\' in f.file_path) > 0
   or position('%' in f.file_path) > 0
   or f.file_path ~ '//'
   or f.file_path ~ '(^|/)\.\.?(/|$)'
order by f.created_at;

-- 2. contractor_documents.file_url (legacy mirror of the first file) ----------
select
  'contractor_documents.file_url' as source,
  cd.id                           as row_id,
  cd.id                           as document_id,
  c.company_id                    as owner_company_id,
  split_part(cd.file_url, '/', 1) as path_company_segment,
  cd.file_url                     as file_path,
  cd.created_at
from public.contractor_documents cd
join public.contractors c on c.id = cd.contractor_id
where cd.file_url is not null
  and (
       left(cd.file_url, 37) <> c.company_id::text || '/'
    or char_length(cd.file_url) < 38
    or position(E'\\' in cd.file_url) > 0
    or position('%' in cd.file_url) > 0
    or cd.file_url ~ '//'
    or cd.file_url ~ '(^|/)\.\.?(/|$)'
  )
order by cd.created_at;
