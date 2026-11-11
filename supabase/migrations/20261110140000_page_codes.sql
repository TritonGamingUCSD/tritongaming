-- Page codes: a six-digit code that takes whoever types it (in the portal's code box) to a page of this site. Made by officers and above, with a name, an optional end date, and a switch. Server-only (no policies): the routes read and write it.
create table if not exists public.page_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[0-9]{6}$'),
  label       text not null check (length(label) between 1 and 80),
  destination text not null check (destination like '/%' and destination not like '//%' and length(destination) <= 2000),
  note        text check (note is null or length(note) <= 300),
  expires_at  timestamptz,
  is_active   boolean not null default true,
  uses        int not null default 0,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.page_codes enable row level security;
