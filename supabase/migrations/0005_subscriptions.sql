-- Subbies — Phase 2 item 7: Stripe billing
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0004.
--
-- One subscription row per company. The app only ever READS this table via
-- RLS; every write happens server-side through the service role (checkout
-- action + Stripe webhook), so Stripe stays the source of truth.
-- ---------------------------------------------------------------------------

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text,                       -- 'starter' | 'business' | 'pro' | null
  status text not null default 'none',
  -- none / trialing / active / past_due / canceled / unpaid / incomplete
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

drop policy if exists "own company subscription read" on public.subscriptions;
create policy "own company subscription read"
on public.subscriptions
for select
to authenticated
using (
  company_id in (select id from public.companies where user_id = auth.uid())
);
