-- Subbies — simple per-key rate limiting (M3)
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0016. Additive only: one table and one
-- function. Safe to re-run.
--
-- Backs the app's rate limiter for the PUBLIC endpoints that run server-side:
-- the contact form and the contractor upload actions. It is not used for
-- signup / login / password-reset — those go straight from the browser to
-- Supabase Auth, which has its own rate limits (set in the Supabase dashboard,
-- Authentication → Rate Limits).
--
-- Only the service role touches this (via the SECURITY DEFINER function below),
-- so the table has RLS on and no policies, like expiry_reminder_log.
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limit_hits (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,          -- which limit, e.g. 'contact', 'onboard_upload'
  key text not null,             -- what's being limited, e.g. an IP or a token
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_lookup
  on public.rate_limit_hits (bucket, key, created_at desc);

alter table public.rate_limit_hits enable row level security;

-- Records one hit and says whether it is within the allowance.
--
-- Fixed-window count: clears this key's own expired hits, counts what's left
-- in the window, and — if under the cap — records this hit and allows it.
-- Returns true = allowed, false = over the limit. Scoped cleanup only (this
-- bucket+key), so it stays cheap. SECURITY DEFINER so the service role can run
-- it; it reads and writes nothing but this one table.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_count int;
begin
  delete from public.rate_limit_hits
   where bucket = p_bucket
     and key = p_key
     and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into current_count
    from public.rate_limit_hits
   where bucket = p_bucket
     and key = p_key;

  if current_count >= p_limit then
    return false;
  end if;

  insert into public.rate_limit_hits (bucket, key) values (p_bucket, p_key);
  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, text, int, int) from public, anon, authenticated;
