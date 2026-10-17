-- Subbies — drop the unused duplicate trial-reminder columns (M8)
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0017. Additive-safe: only drops two
-- columns that nothing in the app reads or writes, and uses IF EXISTS so it is
-- a no-op where they were never present. Safe to re-run.
--
-- The app tracks the two trial reminders in trial_reminder_day5_at and
-- trial_reminder_day7_at (added in migration 0007). An older pair,
-- trial_reminder_5_at and trial_reminder_7_at, lingers in the live database
-- but appears in no migration and no code. Confirm it's empty first with
-- supabase/diagnostics/check-duplicate-reminder-columns.sql, then apply this.
-- ---------------------------------------------------------------------------

alter table public.subscriptions
  drop column if exists trial_reminder_5_at,
  drop column if exists trial_reminder_7_at;
