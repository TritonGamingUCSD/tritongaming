-- Lets the attendee's own "Show QR Code" screen (FullscreenQR.tsx) subscribe
-- to its ticket row and react the instant staff check them in at the
-- scanner, instead of only finding out on a manual page reload. Tables
-- aren't broadcast over Realtime by default — this is what actually turns
-- it on. Existing RLS ("users see their own tickets") still applies to who
-- receives which row's changes, so this doesn't expose anything new.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tickets'
  ) then
    alter publication supabase_realtime add table public.tickets;
  end if;
end $$;
