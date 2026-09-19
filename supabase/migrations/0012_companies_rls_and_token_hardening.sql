-- Subbies — audit pass: make the two hand-created security assumptions true
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0011. Idempotent; safe to re-run; no
-- rows are read, changed or deleted. Safe to run against the live database
-- with no maintenance window: every statement is a metadata change that
-- takes effect instantly, and none of them can fail on existing data unless
-- a precondition noted below is false (in which case it fails loudly and
-- changes nothing).
--
-- Two tables predate this migrations folder and were set up by hand:
-- `companies` and `contractor_tokens`. Every RLS policy in 0001-0011 chains
-- through `companies.user_id = auth.uid()`, and the whole no-login contractor
-- flow rests on `contractor_tokens.token` being unguessable — but neither
-- property is written down anywhere this repo can verify. 0001 and 0003 say
-- "companies already has RLS"; nothing says what `token` defaults to. Same
-- approach as 0010 took with the cascade FKs: rather than trust the
-- assumption, make it true unconditionally. A no-op if it already was.
-- ---------------------------------------------------------------------------

-- 1. companies: RLS on, own-row policies for select / insert / update ------
--
-- Additive on purpose. If correctly-scoped policies already exist under other
-- names they stay — permissive policies OR together, and two correct ones are
-- still correct. If RLS was actually off, or a policy was missing, this is
-- what closes it: without it any signed-in user could read (and update)
-- every company's name, address and phone.
--
-- No delete policy, deliberately. Account deletion goes through the service
-- role (deletion-actions.ts) and cascades from auth.users; nothing
-- user-scoped should be able to delete a company row directly.

alter table public.companies enable row level security;

drop policy if exists "own company companies select" on public.companies;
create policy "own company companies select"
on public.companies
for select
to authenticated
using (user_id = auth.uid());

-- Insert is what signup relies on (app/signup/page.tsx and the account-setup
-- recovery form both insert `{ user_id: <own id>, name }` through the
-- RLS-scoped client). `with check` is what stops a user inserting a company
-- row that points at someone else's user_id.
drop policy if exists "own company companies insert" on public.companies;
create policy "own company companies insert"
on public.companies
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "own company companies update" on public.companies;
create policy "own company companies update"
on public.companies
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- 2. contractor_tokens.token: guarantee it's a random UUID, present, unique --
--
-- createContractor inserts `{ contractor_id }` only and reads `token` back,
-- so the database default is the entire source of the token's randomness.
-- gen_random_uuid() is a v4 UUID: 122 random bits, from the server's CSPRNG.
-- resolveOnboardingToken already rejects anything that isn't UUID-shaped
-- before it queries, so this also matches what the app will accept.
--
-- Precondition for the NOT NULL step: no existing row has a null token. A
-- token row with no token is unreachable by the app anyway (nothing can look
-- it up), so if this step fails the fix is to delete those rows — reported
-- rather than done here, per the audit's no-deletion rule.

alter table public.contractor_tokens
  alter column token set default gen_random_uuid();

alter table public.contractor_tokens
  alter column token set not null;

-- Unique index rather than a constraint so `if not exists` works. Two rows
-- with the same token would make lookup ambiguous; with random UUIDs this
-- can't happen by chance, so a failure here means something was inserted by
-- hand — surface it rather than paper over it.
create unique index if not exists contractor_tokens_token_uniq
  on public.contractor_tokens (token);

-- Read path for the token lookup in resolveOnboardingToken / getOnboardingContext.
create index if not exists contractor_tokens_contractor_id_idx
  on public.contractor_tokens (contractor_id);
