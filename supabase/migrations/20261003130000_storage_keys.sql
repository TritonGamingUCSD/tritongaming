-- Storage key tracker: which keys the club has, and where each one is right now (a member, someone outside the club, or a place).
-- Reached only through the server (service role), which checks the member's role: no policies.
create table if not exists public.storage_keys (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  key_of        text,                                   -- the symbolic part: what it opens / whose it is ("Storage closet", "Marshall's spare")
  color         text not null default '#ffc72c',
  holder_kind   text not null check (holder_kind in ('member', 'person', 'place')),
  holder_user_id uuid references auth.users(id) on delete set null,
  holder_label  text,                                   -- an outsider's name, or the place
  holder_note   text,                                   -- how to reach them / more detail
  held_since    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists storage_keys_holder on public.storage_keys (holder_user_id);
alter table public.storage_keys enable row level security;

-- Every move, so "who had it before" is never lost.
create table if not exists public.storage_key_events (
  id          uuid primary key default gen_random_uuid(),
  key_id      uuid not null references public.storage_keys(id) on delete cascade,
  at          timestamptz not null default now(),
  actor_id    uuid references auth.users(id) on delete set null,
  kind        text not null check (kind in ('created', 'took', 'gave', 'edited')),
  from_kind   text,
  from_user_id uuid references auth.users(id) on delete set null,
  from_label  text,
  to_kind     text,
  to_user_id  uuid references auth.users(id) on delete set null,
  to_label    text,
  note        text
);
create index if not exists storage_key_events_key on public.storage_key_events (key_id, at desc);
alter table public.storage_key_events enable row level security;
