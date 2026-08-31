-- Subbies — Phase 3: 7-day free access tier + forced onboarding
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0005.
--
-- The free tier lives on the existing `subscriptions` table rather than a
-- parallel system: status = 'free' with a `free_ends_at` deadline. The forced
-- plan-selection gate is tracked by `onboarding_completed_at`.
-- ---------------------------------------------------------------------------

alter table public.subscriptions
  add column if not exists free_ends_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists free_reminder_ending_at timestamptz, -- "3 days left" email sent
  add column if not exists free_reminder_ended_at timestamptz;  -- "free access ended" email sent

-- Index for the daily reminder cron.
create index if not exists subscriptions_free_ends_at_idx
  on public.subscriptions (free_ends_at)
  where status = 'free';
