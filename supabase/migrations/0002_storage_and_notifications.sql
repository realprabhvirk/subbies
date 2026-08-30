-- Subbies — Phase 1 items 5-8
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0001.
--
-- 1. Private storage bucket for contractor documents, with size + type limits
--    enforced by Storage itself (so even a signed upload URL can't bypass them).
-- 2. In-app notifications table for "a contractor submitted something".
-- ---------------------------------------------------------------------------

-- 1. Storage bucket ------------------------------------------------------
-- private (public = false); 15 MB cap; PDF + common image types only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contractor-documents',
  'contractor-documents',
  false,
  15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage RLS policies are created on purpose. Nothing authenticated or
-- anonymous may touch this bucket directly — the app reads and writes only
-- through short-lived signed URLs minted server-side by the service role,
-- after it has validated the caller (auth session, or a valid contractor
-- token).

-- 2. notifications ----------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contractor_id uuid references public.contractors(id) on delete cascade,
  type text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_company_created_idx
  on public.notifications (company_id, created_at desc);

alter table public.notifications enable row level security;

-- Companies can read and mark-read their own notifications. Inserts happen
-- only via the service role (contractor-side upload flow), so there is no
-- insert policy for authenticated users.
drop policy if exists "own company notifications read" on public.notifications;
create policy "own company notifications read"
on public.notifications
for select
to authenticated
using (
  company_id in (select id from public.companies where user_id = auth.uid())
);

drop policy if exists "own company notifications update" on public.notifications;
create policy "own company notifications update"
on public.notifications
for update
to authenticated
using (
  company_id in (select id from public.companies where user_id = auth.uid())
)
with check (
  company_id in (select id from public.companies where user_id = auth.uid())
);
