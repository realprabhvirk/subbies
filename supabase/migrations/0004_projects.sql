-- Subbies — Phase 2: projects / job assignment
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0003.
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  address text,
  status text not null default 'active', -- active / on_hold / completed
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create index if not exists projects_company_created_idx
  on public.projects (company_id, created_at desc);

create table if not exists public.project_contractors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  role_on_project text,
  assigned_at timestamptz not null default now(),
  removed_at timestamptz
);

create index if not exists project_contractors_project_idx
  on public.project_contractors (project_id);
create index if not exists project_contractors_contractor_idx
  on public.project_contractors (contractor_id);

-- One active assignment per (project, contractor). Re-assigning after a
-- soft-remove is allowed because removed rows are excluded.
create unique index if not exists project_contractors_active_uniq
  on public.project_contractors (project_id, contractor_id)
  where removed_at is null;

-- RLS ------------------------------------------------------------------
alter table public.projects enable row level security;

drop policy if exists "own company projects" on public.projects;
create policy "own company projects"
on public.projects
for all
to authenticated
using (
  company_id in (select id from public.companies where user_id = auth.uid())
)
with check (
  company_id in (select id from public.companies where user_id = auth.uid())
);

alter table public.project_contractors enable row level security;

drop policy if exists "own company project_contractors" on public.project_contractors;
create policy "own company project_contractors"
on public.project_contractors
for all
to authenticated
using (
  project_id in (
    select p.id from public.projects p
    join public.companies co on co.id = p.company_id
    where co.user_id = auth.uid()
  )
  and contractor_id in (
    select c.id from public.contractors c
    join public.companies co on co.id = c.company_id
    where co.user_id = auth.uid()
  )
)
with check (
  project_id in (
    select p.id from public.projects p
    join public.companies co on co.id = p.company_id
    where co.user_id = auth.uid()
  )
  and contractor_id in (
    select c.id from public.contractors c
    join public.companies co on co.id = c.company_id
    where co.user_id = auth.uid()
  )
);
