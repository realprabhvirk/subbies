-- Subbies — verify (and guarantee) cascade delete across every company/
-- contractor-scoped table
-- ---------------------------------------------------------------------------
-- Run in the Supabase SQL editor after 0009.
--
-- 0008 fixed companies.user_id -> auth.users and its comment claimed
-- "everything else (contractors, documents, projects, subscriptions,
-- notifications) already cascades off companies" — true for the four of
-- those confirmed directly in this repo's own migration SQL (notifications,
-- projects, project_contractors, subscriptions all say `on delete cascade`
-- in 0002/0004/0005). But four tables were never created by a migration
-- tracked here at all — document_types, contractors, contractor_documents,
-- contractor_tokens predate this migrations folder, most likely set up by
-- hand in the Supabase table editor during initial build. contractor_tokens
-- in particular was never even named in 0008's list. Rather than trust that
-- assumption, this makes it true unconditionally: for every FK below, drop
-- whatever constraint currently exists on that column (by whatever name it
-- has) and replace it with an equivalent one that cascades. A no-op if it
-- was already correct; a real fix if it wasn't. Safe to re-run.
-- ---------------------------------------------------------------------------

do $$
declare
  fk record;
  targets text[][] := array[
    array['document_types', 'company_id', 'companies'],
    array['contractors', 'company_id', 'companies'],
    array['contractor_documents', 'contractor_id', 'contractors'],
    array['contractor_tokens', 'contractor_id', 'contractors']
  ];
  t text[];
begin
  foreach t slice 1 in array targets
  loop
    -- Find whatever the existing FK constraint on this column is named,
    -- regardless of naming convention, and drop it.
    for fk in
      select tc.constraint_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on tc.constraint_name = ccu.constraint_name
       and tc.table_schema = ccu.table_schema
      where tc.table_schema = 'public'
        and tc.table_name = t[1]
        and tc.constraint_type = 'FOREIGN KEY'
        and kcu.column_name = t[2]
        and ccu.table_schema = 'public'
        and ccu.table_name = t[3]
    loop
      execute format('alter table public.%I drop constraint %I', t[1], fk.constraint_name);
    end loop;

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete cascade',
      t[1], t[1] || '_' || t[2] || '_fkey', t[2], t[3]
    );
  end loop;
end $$;
