-- Quick links are not documents: a title, an address and a one-line note, shown as tiles on the documentation home. They have their own table
-- (no drafts, versions, comments or tree). Only the server reads and writes it, after checking who is asking.
create table if not exists public.quick_links (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),
  url         text not null check (url ~* '^https://\S+$' and char_length(url) <= 2000),
  note        text not null default '' check (char_length(note) <= 200),
  teams       uuid[] not null default '{}',
  order_index integer not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.quick_links enable row level security;

-- Earlier quick links were docs rows (kind = 'link'). Copy any into the new table; the old rows are then plain docs that can be deleted by hand.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'docs' and column_name = 'kind') then
    insert into public.quick_links (title, url, note, teams, order_index, created_by)
    select title, link_url, left(regexp_replace(coalesce(content, ''), '\s+', ' ', 'g'), 200), teams, row_number() over (order by created_at), created_by
    from public.docs where kind = 'link' and link_url ~* '^https://\S+$';
  end if;
end $$;
alter table public.docs drop column if exists kind;
alter table public.docs drop column if exists link_url;
