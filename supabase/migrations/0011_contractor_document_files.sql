-- Subbies — multiple files per document requirement
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0010, in the schema this project has
-- been on since 0001: table-owning migrations for anything new, defensive
-- do-blocks for anything that has to coexist with hand-created tables.
-- contractor_documents.file_url is what's hand-created here — a single
-- text column, one file per document requirement. This adds a proper table
-- for "one or more files per requirement" instead of stretching that column,
-- and backfills every existing file_url into it so nothing already uploaded
-- is orphaned. file_url itself is left in place (untouched, not read by any
-- new code after this) rather than dropped — this project has broken twice
-- from a migration/deploy ordering mismatch, and a column nothing reads is a
-- far smaller risk than a dropped column something turns out to still need.
-- ---------------------------------------------------------------------------

create table if not exists public.contractor_document_files (
  id uuid primary key default gen_random_uuid(),
  contractor_document_id uuid not null references public.contractor_documents(id) on delete cascade,
  file_path text not null,
  -- The original filename as the contractor's browser reported it.
  -- file_path itself is a random uuid + extension (see buildDocumentPath in
  -- lib/storage.ts) with no human-readable name in it, and with more than
  -- one file per requirement now possible, "the file" is no longer specific
  -- enough to show in the review UI.
  file_name text,
  created_at timestamptz not null default now()
);

create index if not exists contractor_document_files_document_id_idx
  on public.contractor_document_files(contractor_document_id);

alter table public.contractor_document_files enable row level security;

-- Same shape as the "own company contractor_documents" policy in 0001,
-- one join further out.
drop policy if exists "own company contractor_document_files" on public.contractor_document_files;
create policy "own company contractor_document_files"
on public.contractor_document_files
for all
to authenticated
using (
  contractor_document_id in (
    select cd.id
    from public.contractor_documents cd
    join public.contractors c on c.id = cd.contractor_id
    join public.companies co on co.id = c.company_id
    where co.user_id = auth.uid()
  )
)
with check (
  contractor_document_id in (
    select cd.id
    from public.contractor_documents cd
    join public.contractors c on c.id = cd.contractor_id
    join public.companies co on co.id = c.company_id
    where co.user_id = auth.uid()
  )
);

-- Backfill: every contractor_documents row that already has a file gets a
-- matching row here, so the review UI can read exclusively from this table
-- from this point on without losing anything already uploaded. Guarded by
-- a not-exists check so this is safe to re-run.
insert into public.contractor_document_files (contractor_document_id, file_path, file_name)
select cd.id, cd.file_url, null
from public.contractor_documents cd
where cd.file_url is not null
  and not exists (
    select 1 from public.contractor_document_files f
    where f.contractor_document_id = cd.id
      and f.file_path = cd.file_url
  );
