-- Subbies — Phase 3 (revised): forced onboarding + per-plan 7-day trials
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0005.
--
-- The standalone card-free tier was dropped. Every account picks a paid plan
-- at onboarding and goes through Stripe Checkout with a 7-day trial. We track:
--   onboarding_completed_at  — the forced plan-selection gate has been passed
--   trial_reminder_5_at / _7_at — de-dupe the day-5 / day-7 trial reminders
-- ---------------------------------------------------------------------------

alter table public.subscriptions
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists trial_reminder_5_at timestamptz,
  add column if not exists trial_reminder_7_at timestamptz;

-- Index for the daily trial-reminder cron.
create index if not exists subscriptions_trial_end_idx
  on public.subscriptions (trial_end)
  where status = 'trialing';

-- If an earlier draft of this migration ran, drop its now-unused columns.
alter table public.subscriptions
  drop column if exists free_ends_at,
  drop column if exists free_reminder_ending_at,
  drop column if exists free_reminder_ended_at;
