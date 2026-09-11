-- Subbies — account deletion: verification codes + permanent trial-eligibility ledger
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0008.
--
-- Both tables are written only by the service role (everything in
-- app/dashboard/settings/deletion-actions.ts and lib/auth/deletion-codes.ts
-- and lib/billing/trial-eligibility.ts goes through createAdminClient()).
-- RLS is enabled with no policies at all on either table, which denies every
-- access path for the anon/authenticated roles and leaves only the service
-- role, which bypasses RLS entirely. Neither table is ever meant to be read
-- through a user-scoped client.
-- ---------------------------------------------------------------------------

-- One pending deletion code per user. A fresh request overwrites the
-- previous row (upsert on user_id) — there's nothing worth keeping once a
-- new code is issued, and `on delete cascade` also wipes this the moment the
-- auth user is deleted, whether the deletion that row was for succeeded or
-- the user just never finished it.
create table if not exists public.account_deletion_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.account_deletion_codes enable row level security;

-- Permanent record of which normalized emails have already consumed a free
-- trial. Written once, right before the auth user is deleted (see
-- confirmAccountDeletion in deletion-actions.ts), and never cleared —
-- clearing it would defeat the entire point, which is that deleting an
-- account and signing back up under the same address can't re-claim a trial.
create table if not exists public.used_trial_emails (
  email text primary key,
  deleted_at timestamptz not null default now()
);

alter table public.used_trial_emails enable row level security;
