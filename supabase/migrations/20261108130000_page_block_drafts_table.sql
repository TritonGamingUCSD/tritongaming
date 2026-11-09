-- Drafts of a page's blocks live in their own table, not a column of events/divisions: those tables are readable by everyone (they hold the public pages), and an unpublished draft must not be.
alter table public.events drop column if exists page_blocks_draft;
alter table public.divisions drop column if exists page_blocks_draft;

create table if not exists public.page_block_drafts (
  entity_type text not null check (entity_type in ('event', 'division')),
  entity_id uuid not null,
  blocks jsonb not null,
  saved_by uuid references auth.users (id) on delete set null,
  saved_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);
-- Only the API reads and writes it, after checking who may edit the page.
alter table public.page_block_drafts enable row level security;

-- Publishing the blocks keeps a copy in the history and removes the draft.
create or replace function public.page_blocks_changed() returns trigger language plpgsql security definer set search_path = public as $$
declare kind text := case tg_table_name when 'events' then 'event' else 'division' end;
begin
  if new.page_blocks is distinct from old.page_blocks then
    insert into public.page_block_versions (entity_type, entity_id, blocks, saved_by) values (kind, new.id, coalesce(new.page_blocks, '[]'::jsonb), auth.uid());
    delete from public.page_block_versions v
      where v.entity_type = kind and v.entity_id = new.id
        and v.id not in (select id from public.page_block_versions where entity_type = kind and entity_id = new.id order by created_at desc limit 40);
    delete from public.page_block_drafts where entity_type = kind and entity_id = new.id;
  end if;
  return new;
end $$;
