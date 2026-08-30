-- Subbies — Phase 2: company profile fields
-- ---------------------------------------------------------------------------
-- Adds optional company-level detail fields edited from the Settings page.
-- companies already has RLS (auth.uid() = user_id for select/insert/update),
-- so no policy changes are needed.
-- ---------------------------------------------------------------------------

alter table public.companies
  add column if not exists address text,
  add column if not exists phone text;
