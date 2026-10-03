-- Club custom emojis for the meeting screen. Anyone who attends meetings can upload one; an exec/admin approves it
-- before it appears. Images live in a public bucket (they're club emojis); only the server writes to it.
create table if not exists public.custom_emojis (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  path        text not null,
  status      text not null default 'pending' check (status in ('pending', 'approved')),
  created_by  uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index if not exists custom_emojis_name_uniq on public.custom_emojis (lower(name));
alter table public.custom_emojis enable row level security;   -- service role only

insert into storage.buckets (id, name, public) values ('custom-emojis', 'custom-emojis', true)
on conflict (id) do nothing;
