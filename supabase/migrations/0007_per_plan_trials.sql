-- Subbies — Phase 3.6: per-plan 7-day trials, standalone free tier removed
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0006.
--
-- Reverses the card-free "free access" tier. Every account now goes through
-- Stripe Checkout at onboarding with a 7-day trial attached to the plan it
-- picked: card up front, A$0 during the trial, real charge on day 7. Trial
-- state lives in `status = 'trialing'` + `trial_end`, which Stripe already
-- owns — so the parallel free_ends_at bookkeeping goes away.
--
-- Safe to run even if 0006 was never applied: every step is guarded.
-- ---------------------------------------------------------------------------

-- New idempotency stamps for the day-5 / day-7 trial reminder emails. Both the
-- daily cron and Stripe's trial_will_end webhook claim through these, so a
-- company gets each reminder at most once.
alter table public.subscriptions
  add column if not exists trial_reminder_day5_at timestamptz,
  add column if not exists trial_reminder_day7_at timestamptz;

-- 0006 added this and the app still relies on it for the onboarding gate.
alter table public.subscriptions
  add column if not exists onboarding_completed_at timestamptz;

-- Anyone sitting on the old card-free tier has no card on file, so there is no
-- subscription to convert them into. Send them back through onboarding to pick
-- a plan (which starts a real 7-day trial). No data is touched — only the
-- billing state and the onboarding gate.
update public.subscriptions
   set status = 'none',
       onboarding_completed_at = null,
       updated_at = now()
 where status = 'free';

-- The free-tier index and columns are dead once no row can be 'free'.
drop index if exists public.subscriptions_free_ends_at_idx;

alter table public.subscriptions
  drop column if exists free_ends_at,
  drop column if exists free_reminder_ending_at,
  drop column if exists free_reminder_ended_at;

-- Drives the daily trial-reminder cron.
create index if not exists subscriptions_trial_end_idx
  on public.subscriptions (trial_end)
  where status = 'trialing';
