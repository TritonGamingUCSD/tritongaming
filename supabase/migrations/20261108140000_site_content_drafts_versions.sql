-- Site Content: a saved-but-unpublished draft of each block, and a history of what was published (the latest 30 per block).
create table if not exists public.site_content_drafts (
  key text primary key,
  content jsonb not null,
  saved_by uuid references auth.users (id) on delete set null,
  saved_at timestamptz not null default now()
);
create table if not exists public.site_content_versions (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  content jsonb not null,
  saved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists site_content_versions_key_idx on public.site_content_versions (key, created_at desc);
-- Read and written only through the API (which checks who may edit the site's content), never straight from the browser.
alter table public.site_content_drafts enable row level security;
alter table public.site_content_versions enable row level security;

-- Publishing a block (a save of site_contents) keeps a copy in the history and removes its draft.
create or replace function public.site_content_changed() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.content is distinct from old.content then
    insert into public.site_content_versions (key, content, saved_by) values (new.key, coalesce(new.content, '{}'::jsonb), coalesce(new.updated_by, auth.uid()));
    delete from public.site_content_versions v
      where v.key = new.key and v.id not in (select id from public.site_content_versions where key = new.key order by created_at desc limit 30);
    delete from public.site_content_drafts where key = new.key;
  end if;
  return new;
end $$;

drop trigger if exists site_contents_changed on public.site_contents;
create trigger site_contents_changed after insert or update on public.site_contents for each row execute function public.site_content_changed();
