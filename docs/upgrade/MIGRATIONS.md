# Subbies upgrade: migrations

Claude never applies migrations to production. Mr Virk applies each file in the Supabase SQL editor, in order, then runs its verification query.

| # | File | Phase | Apply before |
|---|---|---|---|
