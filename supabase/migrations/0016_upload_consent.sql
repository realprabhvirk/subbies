-- Subbies — record what a contractor agreed to when they uploaded
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0015. Safe to run more than once.
--
-- The upload page now makes the contractor tick a box agreeing to the Privacy
-- Policy and the applicable parts of the Terms before they can submit. This
-- records that agreement against the document they submitted: when they
-- agreed, and which version of each document they agreed to.
--
-- Columns are nullable on purpose: every document submitted before this
-- change has no agreement on record, and that should read as "unknown", not
-- as a made-up value. A resubmission overwrites the record with the
-- agreement behind the current submission.
--
-- The app writes these in a separate, best-effort step after the submission
-- itself succeeds, so uploads keep working if code is deployed before this
-- is run — but until it is run, no agreement is recorded.
--
-- No policy changes: these are columns on an existing table, so the existing
-- "own company contractor_documents" policy already covers them. They are
-- cleaned up with the rest of a company's data on account deletion
-- (contractor_documents rows cascade from contractors, from companies).
-- ---------------------------------------------------------------------------

alter table public.contractor_documents
  add column if not exists agreed_at timestamptz,
  add column if not exists agreed_terms_version text,
  add column if not exists agreed_privacy_version text;

comment on column public.contractor_documents.agreed_at is
  'When the contractor ticked the Privacy Policy / Terms box on the upload page for the current submission.';
comment on column public.contractor_documents.agreed_terms_version is
  'TERMS_VERSION (lib/legal/terms.ts) live when they agreed.';
comment on column public.contractor_documents.agreed_privacy_version is
  'PRIVACY_VERSION (lib/legal/privacy.ts) live when they agreed.';

-- Make PostgREST pick up the new columns straight away instead of on its
-- next schema-cache refresh.
notify pgrst, 'reload schema';
