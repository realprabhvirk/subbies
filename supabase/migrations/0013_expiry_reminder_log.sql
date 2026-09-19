-- Subbies — automatic expiry reminders: the sent-reminder ledger
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0012. Creates one new table and
-- touches nothing else. Safe to re-run; no existing rows are read or changed.
--
-- This table is the idempotency guarantee for /api/cron/expiry-reminders.
-- The job can run twice — a manual trigger on the same day, a Vercel retry,
-- two deploys racing — and the unique constraint below means nobody is
-- emailed the same reminder twice.
-- ---------------------------------------------------------------------------

create table if not exists public.expiry_reminder_log (
  id uuid primary key default gen_random_uuid(),
  contractor_document_id uuid not null
    references public.contractor_documents(id) on delete cascade,
  contractor_id uuid not null
    references public.contractors(id) on delete cascade,

  -- The expiry this reminder was ABOUT, not when it was sent. This column is
  -- what makes renewals work. Documents are updated in place: renewing a
  -- certificate reuses the same contractor_documents row and just moves
  -- expiry_date forward. Keyed on (document, threshold) alone, the "30 days
  -- left" reminder sent in 2026 would permanently suppress the 2027 one on
  -- the same row — the feature would quietly work once per document, ever.
  -- Including the expiry date means a renewal starts a clean cycle.
  expiry_date date not null,

  -- Which window this was filed under: the matching entry from the document
  -- type's reminder_days ('30', '14', '7', ...), or 'overdue' for the
  -- post-expiry escalation to the company. Text rather than an enum because
  -- reminder_days is company-configurable (any whole number up to 3650).
  threshold text not null,

  sent_at timestamptz not null default now()
);

-- The actual guarantee. One reminder per document, per expiry, per window.
create unique index if not exists expiry_reminder_log_unique
  on public.expiry_reminder_log (contractor_document_id, expiry_date, threshold);

-- The job's own read: "what have I already sent for these documents?"
create index if not exists expiry_reminder_log_document_idx
  on public.expiry_reminder_log (contractor_document_id);

-- RLS on with no policies at all, matching account_deletion_codes and
-- used_trial_emails from 0009: this denies every access path for the anon and
-- authenticated roles, leaving only the service role, which bypasses RLS.
-- Nothing in the UI reads this table — it exists for the job's own
-- bookkeeping — so there is no policy to write until something does.
alter table public.expiry_reminder_log enable row level security;
