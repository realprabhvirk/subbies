-- Read-only check for existing +tag duplicate accounts (Gmail/Outlook family).
-- Nothing is modified or deleted — this only reports what it finds.
--
-- Mirrors the exact same rule as lib/auth/normalize-email.ts: lowercase, then
-- for gmail.com/googlemail.com/outlook.com/hotmail.com/live.com, strip
-- everything from the first '+' to '@' in the local part. Run in the
-- Supabase SQL Editor (needs auth.users, which the app itself cannot query).

with computed as (
  select
    u.id as user_id,
    u.email as raw_email,
    u.created_at,
    c.name as company_name,
    case
      when split_part(lower(u.email), '@', 2)
        in ('gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com')
      then split_part(lower(u.email), '+', 1) || '@' || split_part(lower(u.email), '@', 2)
      else lower(u.email)
    end as normalized_email
  from auth.users u
  left join public.companies c on c.user_id = u.id
)
select
  normalized_email,
  count(*) as account_count,
  array_agg(raw_email order by created_at) as raw_emails,
  array_agg(company_name order by created_at) as company_names,
  array_agg(user_id order by created_at) as user_ids,
  array_agg(created_at order by created_at) as created_at_list
from computed
group by normalized_email
having count(*) > 1
order by account_count desc;
