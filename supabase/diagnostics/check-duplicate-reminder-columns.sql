-- Subbies — diagnostic (READ-ONLY): data in the duplicate reminder columns
-- ---------------------------------------------------------------------------
-- Paste into the Supabase SQL editor and run BEFORE applying migration 0018.
-- It only SELECTs.
--
-- The app uses trial_reminder_day5_at / trial_reminder_day7_at. An older,
-- unused pair (trial_reminder_5_at / trial_reminder_7_at) also exists in the
-- live database; nothing in the code reads or writes it. Migration 0018 drops
-- that unused pair. This confirms first that it holds no data worth keeping.
--
-- Expected result: non_null_5_at = 0 and non_null_7_at = 0. If either is above
-- zero, DON'T apply 0018 yet — send this result to Claude.
--
-- (If the query errors with "column does not exist", the duplicate pair isn't
-- there at all and 0018 will simply be a no-op — that's fine.)
-- ---------------------------------------------------------------------------

select
  count(*) filter (where trial_reminder_5_at is not null) as non_null_5_at,
  count(*) filter (where trial_reminder_7_at is not null) as non_null_7_at,
  count(*) filter (where trial_reminder_day5_at is not null) as non_null_day5_at,
  count(*) filter (where trial_reminder_day7_at is not null) as non_null_day7_at
from public.subscriptions;
