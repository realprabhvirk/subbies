-- Subbies — company-scoped Row Level Security
-- ---------------------------------------------------------------------------
-- Run this in the Supabase SQL editor (or via the Supabase CLI).
--
-- `companies` already has RLS with auth.uid() = user_id policies. This adds
-- equivalent protection to every other table the authenticated dashboard
-- touches, so a company can only ever see or change its own rows.
--
-- The public contractor upload flow (/onboard/[token]) does NOT use these
-- policies — it will be served by a server route that validates the token and
-- uses the service role key. See the build brief, section 3.
-- ---------------------------------------------------------------------------

-- Helper: the set of company ids owned by the current auth user.
-- Inlined as a subquery in each policy below rather than a SQL function to
-- keep things obvious.

-- document_types -----------------------------------------------------------
alter table public.document_types enable row level security;

drop policy if exists "own company document_types" on public.document_types;
create policy "own company document_types"
on public.document_types
for all
to authenticated
using (
  company_id in (select id from public.companies where user_id = auth.uid())
)
with check (
  company_id in (select id from public.companies where user_id = auth.uid())
);

-- contractors -------------------------------------------------------------
alter table public.contractors enable row level security;

drop policy if exists "own company contractors" on public.contractors;
create policy "own company contractors"
on public.contractors
for all
to authenticated
using (
  company_id in (select id from public.companies where user_id = auth.uid())
)
with check (
  company_id in (select id from public.companies where user_id = auth.uid())
);

-- contractor_documents --------------------------------------------------
alter table public.contractor_documents enable row level security;

drop policy if exists "own company contractor_documents" on public.contractor_documents;
create policy "own company contractor_documents"
on public.contractor_documents
for all
to authenticated
using (
  contractor_id in (
    select c.id
    from public.contractors c
    join public.companies co on co.id = c.company_id
    where co.user_id = auth.uid()
  )
)
with check (
  contractor_id in (
    select c.id
    from public.contractors c
    join public.companies co on co.id = c.company_id
    where co.user_id = auth.uid()
  )
);

-- contractor_tokens ---------------------------------------------------
alter table public.contractor_tokens enable row level security;

drop policy if exists "own company contractor_tokens" on public.contractor_tokens;
create policy "own company contractor_tokens"
on public.contractor_tokens
for all
to authenticated
using (
  contractor_id in (
    select c.id
    from public.contractors c
    join public.companies co on co.id = c.company_id
    where co.user_id = auth.uid()
  )
)
with check (
  contractor_id in (
    select c.id
    from public.contractors c
    join public.companies co on co.id = c.company_id
    where co.user_id = auth.uid()
  )
);
