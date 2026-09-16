-- Grows the docs MVP: real (creatable/renameable) categories instead of a
-- free-text field, one level of sub-posts under a top-level doc (parent_id,
-- self-referencing), and attachments (uploaded files or a pasted link like
-- a Google Photos album) per doc.
create table public.doc_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.doc_categories enable row level security;

create policy "manage_docs can read categories" on public.doc_categories
  for select using (has_capability('manage_docs'));
create policy "manage_docs can insert categories" on public.doc_categories
  for insert with check (has_capability('manage_docs'));
create policy "manage_docs can update categories" on public.doc_categories
  for update using (has_capability('manage_docs')) with check (has_capability('manage_docs'));
create policy "manage_docs can delete categories" on public.doc_categories
  for delete using (has_capability('manage_docs'));

alter table public.docs add column category_id uuid references public.doc_categories(id) on delete set null;
-- Sub-posts nest one level under a top-level doc — the app only ever lets a
-- doc with parent_id already set be picked as a *document*, not as a parent
-- itself, but this is self-referencing so nothing stops deeper nesting at
-- the schema level if that's wanted later.
alter table public.docs add column parent_id uuid references public.docs(id) on delete cascade;
alter table public.docs add column order_index int not null default 0;
-- Each item: { name, url, kind: 'file' | 'google_album' }.
alter table public.docs add column attachments jsonb not null default '[]'::jsonb;

-- Backfill: turn each distinct existing free-text category into a real row
-- instead of just dropping people's data.
insert into public.doc_categories (name)
select distinct category from public.docs where category is not null
on conflict (name) do nothing;

update public.docs d
set category_id = c.id
from public.doc_categories c
where d.category = c.name;

alter table public.docs drop column category;

-- Storage bucket for doc attachments — public read (this is an internal
-- club tool, not classified content, matching the simplicity of every
-- other upload bucket this app has), writes gated the same as the docs
-- table itself.
insert into storage.buckets (id, name, public)
values ('doc-attachments', 'doc-attachments', true)
on conflict (id) do nothing;

create policy "doc-attachments public read"
  on storage.objects for select
  using (bucket_id = 'doc-attachments');

create policy "doc-attachments manage_docs insert"
  on storage.objects for insert
  with check (bucket_id = 'doc-attachments' and has_capability('manage_docs'));

create policy "doc-attachments manage_docs update"
  on storage.objects for update
  using (bucket_id = 'doc-attachments' and has_capability('manage_docs'))
  with check (bucket_id = 'doc-attachments' and has_capability('manage_docs'));

create policy "doc-attachments manage_docs delete"
  on storage.objects for delete
  using (bucket_id = 'doc-attachments' and has_capability('manage_docs'));
