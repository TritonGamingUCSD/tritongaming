-- The Newspaper is now called the Newsletter, all the way down: tables, their indexes, constraints, the sequence, the click function, the permission names (and who was granted them), the "newspaper" issue type, and the pictures bucket.
-- Run it right before the new code goes live: the old code looks for the old names. Safe to run once (a second run finds nothing to rename).
do $$
declare r record;
begin
  -- tables first, so the loops below see the new names
  for r in select tablename from pg_tables where schemaname = 'public' and tablename like 'newspaper\_%' loop
    execute format('alter table public.%I rename to %I', r.tablename, replace(r.tablename, 'newspaper', 'newsletter'));
  end loop;
  for r in select sequencename from pg_sequences where schemaname = 'public' and sequencename like 'newspaper%' loop
    execute format('alter sequence public.%I rename to %I', r.sequencename, replace(r.sequencename, 'newspaper', 'newsletter'));
  end loop;
  for r in select c.conname, c.conrelid::regclass::text as tbl from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.conname like 'newspaper%' loop
    execute format('alter table %s rename constraint %I to %I', r.tbl, r.conname, replace(r.conname, 'newspaper', 'newsletter'));
  end loop;
  for r in select indexname from pg_indexes where schemaname = 'public' and indexname like 'newspaper%' loop
    execute format('alter index public.%I rename to %I', r.indexname, replace(r.indexname, 'newspaper', 'newsletter'));
  end loop;
  for r in select schemaname, tablename, policyname from pg_policies where policyname like '%newspaper%' and schemaname = 'public' loop
    execute format('alter policy %I on %I.%I rename to %I', r.policyname, r.schemaname, r.tablename, replace(r.policyname, 'newspaper', 'newsletter'));
  end loop;
end $$;

-- the click counter (a SQL function keeps its body as text, so it is written again with the new table name)
create or replace function public.newsletter_click(p_issue uuid, p_n int) returns text
language sql security definer set search_path = public as $$
  update public.newsletter_links set clicks = clicks + 1 where issue_id = p_issue and n = p_n returning url;
$$;
revoke all on function public.newsletter_click(uuid, int) from public, anon, authenticated;
drop function if exists public.newspaper_click(uuid, int);

-- the issue type "newspaper" becomes "newsletter"
alter table public.newsletter_issues drop constraint if exists newsletter_issues_type_check;
alter table public.newsletter_issues alter column type set default 'newsletter';
update public.newsletter_issues set type = 'newsletter' where type = 'newspaper';
alter table public.newsletter_issues add constraint newsletter_issues_type_check check (type in ('newsletter', 'event_announcement', 'event_update', 'event_reminder'));

-- permissions: whoever was granted the old names is granted the new ones
update public.capability_grants set capability = 'write_newsletter' where capability = 'write_newspaper';
update public.capability_grants set capability = 'send_newsletter' where capability = 'send_newspaper';

-- the pictures bucket: a new one with the same rules (the old one held no files when this was written; any that it does hold are moved by hand before it is deleted)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('newsletter-images', 'newsletter-images', true, 393216, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = 393216, allowed_mime_types = array['image/webp'];
drop policy if exists "newsletter-images public read" on storage.objects;
create policy "newsletter-images public read" on storage.objects for select using (bucket_id = 'newsletter-images');
drop policy if exists "newspaper-images public read" on storage.objects;
