-- Subbies — cascade-delete companies when the auth user is deleted
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0007.
--
-- `companies.user_id` references `auth.users(id)` but was created before this
-- migration history started, without `on delete cascade`. That's why deleting
-- a user from Auth → Users (or via the admin API) fails with a foreign key
-- violation: Postgres won't drop the auth.users row while a companies row
-- still points at it, and everything else (contractors, documents, projects,
-- subscriptions, notifications) already cascades off companies.
--
-- Drops whatever that FK is currently named and replaces it with an
-- equivalent one that cascades. Tries the common name directly, then falls
-- back to looking it up for environments where it's named something else.
-- Safe to re-run. No data is touched.
-- ---------------------------------------------------------------------------

alter table public.companies drop constraint if exists companies_user_id_fkey;

do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name
   and tc.table_schema = ccu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'companies'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'user_id'
    and ccu.table_schema = 'auth'
    and ccu.table_name = 'users'
  limit 1;

  if fk_name is not null then
    execute format('alter table public.companies drop constraint %I', fk_name);
  end if;
end $$;

alter table public.companies
  add constraint companies_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
