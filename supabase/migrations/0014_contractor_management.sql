-- Subbies — contractor management: ABN, link expiry, resend cooldown
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0013. Additive only: three new
-- nullable columns and one check constraint. Nothing is dropped or rewritten,
-- and no existing row's data changes. Safe to re-run.
-- ---------------------------------------------------------------------------

-- 1. contractors.abn ---------------------------------------------------------
-- Stored as the bare 11 digits (the app strips spaces on save and re-inserts
-- them for display). Nullable: every existing contractor has none.
alter table public.contractors
  add column if not exists abn text;

-- Defence in depth behind the server-side validation. Guarded so a re-run
-- doesn't fail on "constraint already exists" (Postgres has no
-- ADD CONSTRAINT IF NOT EXISTS). Existing rows are all null, which the check
-- allows, so this cannot fail on current data.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contractors_abn_format'
      and conrelid = 'public.contractors'::regclass
  ) then
    alter table public.contractors
      add constraint contractors_abn_format
      check (abn is null or abn ~ '^[0-9]{11}$');
  end if;
end $$;

-- 2. contractor_tokens.expires_at --------------------------------------------
-- Added WITHOUT a default first, then the default is set separately. In
-- Postgres, adding a column with a default backfills every existing row with
-- that value — which here would silently put a 60-day fuse on every link
-- already sitting in a contractor's inbox. Done in this order, existing rows
-- stay NULL, and NULL means "never expires" (today's behaviour), until the
-- next time the app emails that contractor a link, which extends it.
-- New rows (a contractor added from now on) get now() + 60 days.
alter table public.contractor_tokens
  add column if not exists expires_at timestamptz;

alter table public.contractor_tokens
  alter column expires_at set default (now() + interval '60 days');

-- 3. contractor_tokens.last_request_sent_at ----------------------------------
-- When a company last emailed this contractor a request. Backs the resend
-- cooldown, so it survives a page reload and can't be dodged by refreshing.
alter table public.contractor_tokens
  add column if not exists last_request_sent_at timestamptz;

-- No RLS changes needed. The existing "own company contractors" and
-- "own company contractor_tokens" policies are `for all`, so they already
-- cover updating these columns for the owning company and nobody else.
