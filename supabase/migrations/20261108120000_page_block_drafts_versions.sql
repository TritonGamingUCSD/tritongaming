-- Page builder: a saved-but-unpublished draft of an event's or division's blocks, and a history of what was published.
alter table public.events add column if not exists page_blocks_draft jsonb;
alter table public.divisions add column if not exists page_blocks_draft jsonb;

create table if not exists public.page_block_versions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('event', 'division')),
  entity_id uuid not null,
  blocks jsonb not null,
  saved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists page_block_versions_entity_idx on public.page_block_versions (entity_type, entity_id, created_at desc);
-- Read and written only through the API (which checks who may edit the page), never straight from the browser.
alter table public.page_block_versions enable row level security;

-- Every time the published blocks change: keep a copy (the newest 40 per page) and clear the draft, since it has now been published.
create or replace function public.page_blocks_changed() returns trigger language plpgsql security definer set search_path = public as $$
declare kind text := case tg_table_name when 'events' then 'event' else 'division' end;
begin
  if new.page_blocks is distinct from old.page_blocks then
    insert into public.page_block_versions (entity_type, entity_id, blocks, saved_by) values (kind, new.id, coalesce(new.page_blocks, '[]'::jsonb), auth.uid());
    delete from public.page_block_versions v
      where v.entity_type = kind and v.entity_id = new.id
        and v.id not in (select id from public.page_block_versions where entity_type = kind and entity_id = new.id order by created_at desc limit 40);
    new.page_blocks_draft := null;
  end if;
  return new;
end $$;

drop trigger if exists events_page_blocks_changed on public.events;
create trigger events_page_blocks_changed before update on public.events for each row execute function public.page_blocks_changed();
drop trigger if exists divisions_page_blocks_changed on public.divisions;
create trigger divisions_page_blocks_changed before update on public.divisions for each row execute function public.page_blocks_changed();
