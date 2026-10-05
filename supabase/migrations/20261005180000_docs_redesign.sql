-- Docs redesign: icon and cover per doc, tags, pinning, nested pages (parent_id already exists, now any depth), a private team draft that is published
-- on request, version history, favorites, and a light "someone is editing" signal.

alter table public.docs
  add column if not exists icon text,
  add column if not exists cover_url text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists pinned boolean not null default false,
  add column if not exists published boolean not null default true,        -- false = a brand new doc nobody but editors can see until its first publish
  add column if not exists revision int not null default 1,                -- bumped on every publish; saves say which revision they were based on
  add column if not exists draft_title text,
  add column if not exists draft_content text,
  add column if not exists draft_updated_at timestamptz,
  add column if not exists draft_updated_by uuid references public.profiles(id) on delete set null;

-- Every publish keeps what the doc said, so it can be looked at and brought back.
create table if not exists public.doc_versions (
  id         uuid primary key default gen_random_uuid(),
  doc_id     uuid not null references public.docs(id) on delete cascade,
  title      text not null,
  content    text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  note       text
);
create index if not exists doc_versions_doc_idx on public.doc_versions (doc_id, created_at desc);
alter table public.doc_versions enable row level security;   -- server-only: read and written by routes that check who is asking

create table if not exists public.doc_favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  doc_id     uuid not null references public.docs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, doc_id)
);
alter table public.doc_favorites enable row level security;

-- Who has a doc open in the editor right now (a heartbeat; a row older than about a minute means they left).
create table if not exists public.doc_editing (
  doc_id    uuid not null references public.docs(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  last_seen timestamptz not null default now(),
  primary key (doc_id, user_id)
);
alter table public.doc_editing enable row level security;

-- Today's docs are already published: keep what each says as its first version.
insert into public.doc_versions (doc_id, title, content, created_by, created_at, note)
select id, title, content, updated_by, updated_at, 'Before the redesign' from public.docs
where not exists (select 1 from public.doc_versions v where v.doc_id = docs.id);
