-- Subbies — document archive/replacement lifecycle + contractor notes
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0014. Additive only: two nullable
-- columns on contractor_documents and one new table. Nothing is dropped or
-- rewritten, and no existing row's data changes. Safe to re-run.
-- ---------------------------------------------------------------------------

-- 1. contractor_documents.archived_at ----------------------------------------
-- NULL = a live document. A timestamp = archived: kept purely as a record
-- (file stays in private storage) and ignored by everything that decides
-- compliance, the dashboard, reminders, emails and the contractor's page.
alter table public.contractor_documents
  add column if not exists archived_at timestamptz;

-- 2. contractor_documents.replaces_document_id -------------------------------
-- Documents are updated in place in this app: one row per requirement, files
-- swapped on resubmit. That can't express "the approved copy stays valid while
-- an updated one is requested" — there's nowhere to put the new upload without
-- overwriting the approved one. So a resend on an approved document adds a
-- SECOND row pointing at the first through this column.
--
-- While it's set, the row is a pending replacement: compliance, the dashboard
-- and status derivation ignore it, so the original stays exactly as valid as it
-- was. Approving the replacement archives the original and clears this link,
-- at which point the replacement becomes the live document.
--
-- ON DELETE SET NULL: deleting the original promotes its replacement to the
-- live document instead of deleting it or blocking the delete.
alter table public.contractor_documents
  add column if not exists replaces_document_id uuid
    references public.contractor_documents(id) on delete set null;

-- Partial indexes: nearly every row is live and unlinked, so these stay tiny
-- and only cost anything for the rows they exist to find.
create index if not exists contractor_documents_archived_idx
  on public.contractor_documents (contractor_id)
  where archived_at is not null;

create index if not exists contractor_documents_replaces_idx
  on public.contractor_documents (replaces_document_id)
  where replaces_document_id is not null;

-- No RLS change: the existing "own company contractor_documents" policy is
-- `for all`, so it already covers these columns for the owning company only.

-- 3. contractor_notes --------------------------------------------------------
-- Private notes a company keeps about a contractor. Only ever read through the
-- company's own authenticated session; nothing in the contractor-facing flow
-- or any email touches this table.
create table if not exists public.contractor_notes (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null
    references public.contractors(id) on delete cascade,
  -- Denormalised from the contractor so the RLS check is a direct comparison
  -- rather than a join, matching how document_types/projects are scoped.
  company_id uuid not null
    references public.companies(id) on delete cascade,
  author_id uuid not null
    references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists contractor_notes_contractor_idx
  on public.contractor_notes (contractor_id, created_at desc);

alter table public.contractor_notes enable row level security;

drop policy if exists "own company contractor_notes read" on public.contractor_notes;
create policy "own company contractor_notes read"
on public.contractor_notes
for select
to authenticated
using (
  company_id in (select id from public.companies where user_id = auth.uid())
);

-- The insert check does three jobs: the note is filed under the caller's own
-- company, it's authored by the caller, and the contractor it's attached to
-- really belongs to that company — so a note can't be planted on another
-- company's contractor by naming its id.
drop policy if exists "own company contractor_notes insert" on public.contractor_notes;
create policy "own company contractor_notes insert"
on public.contractor_notes
for insert
to authenticated
with check (
  company_id in (select id from public.companies where user_id = auth.uid())
  and author_id = auth.uid()
  and contractor_id in (
    select c.id from public.contractors c
    where c.company_id = contractor_notes.company_id
  )
);

drop policy if exists "own company contractor_notes delete" on public.contractor_notes;
create policy "own company contractor_notes delete"
on public.contractor_notes
for delete
to authenticated
using (
  company_id in (select id from public.companies where user_id = auth.uid())
);

-- Deliberately no update policy: notes can be added and deleted, not edited,
-- so an update is denied by default.
