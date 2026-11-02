-- Polls: a contest or on-stage vote run from the portal (Polls section) and voted on from phones by anyone with the 6-digit code, no account needed (guests sign in anonymously, like Trivia players).
-- A poll has entries (a number, a name, an optional line and a picture), a way to vote (`mode`: one favourite, a top 3, or a score from 1 to 5) and a way to show results (`reveal`: live bars, or hidden until the host reveals them).
-- `status`: draft (being set up), open (voting, has the code), closed (voting over, results still hidden), revealed (results shown; the code is given back).
-- Everything goes through the site's own routes (service role): the tables have row level security on and no policies, so no browser can read or write them directly, and guests are refused by the "no anonymous sessions" policy as everywhere else.
-- Additive. Safe to run once.
create table if not exists public.polls (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  mode       text not null default 'one' check (mode in ('one', 'top3', 'score')),
  reveal     text not null default 'live' check (reveal in ('live', 'hidden')),
  status     text not null default 'draft' check (status in ('draft', 'open', 'closed', 'revealed')),
  code       text unique check (code is null or code ~ '^[0-9]{6}$'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opened_at  timestamptz,
  closed_at  timestamptz
);

create table if not exists public.poll_entries (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls(id) on delete cascade,
  number     int  not null check (number between 1 and 999),
  name       text not null check (char_length(name) between 1 and 80),
  subtitle   text not null default '' check (char_length(subtitle) <= 120),
  image      text not null default '',   -- the picture's full public address in the 'poll-images' bucket (the weekly tidy-up finds files still in use by reading text columns)
  created_at timestamptz not null default now(),
  unique (poll_id, number)
);

-- One row per entry a person voted for: `value` is 1 (one favourite), the points 3, 2 or 1 (top 3), or the score 1 to 5. `user_id` is an auth user, which for a guest is an anonymous session with no profile.
create table if not exists public.poll_votes (
  poll_id    uuid not null references public.polls(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  entry_id   uuid not null references public.poll_entries(id) on delete cascade,
  value      smallint not null check (value between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id, entry_id)
);
create index if not exists poll_votes_entry_idx on public.poll_votes (poll_id, entry_id);
create index if not exists poll_entries_poll_idx on public.poll_entries (poll_id, number);

alter table public.polls enable row level security;
alter table public.poll_entries enable row level security;
alter table public.poll_votes enable row level security;

-- Guests (anonymous sign-ins) are refused on every table (see 20261024130000_block_anonymous.sql); a new table needs the same line.
do $$
declare t text;
begin
  foreach t in array array['polls', 'poll_entries', 'poll_votes'] loop
    execute format('drop policy if exists "no anonymous sessions" on public.%I', t);
    execute format($p$create policy "no anonymous sessions" on public.%I as restrictive for all to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false) with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)$p$, t);
  end loop;
end $$;

-- Entry pictures: small WebP files made in the browser and uploaded by the route that checks who may edit the poll, so the bucket has no write policy for browsers; reads are public (unguessable file names).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('poll-images', 'poll-images', true, 262144, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = 262144, allowed_mime_types = array['image/webp'];

drop policy if exists "poll-images public read" on storage.objects;
create policy "poll-images public read" on storage.objects for select using (bucket_id = 'poll-images');
