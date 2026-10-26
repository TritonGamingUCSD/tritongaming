-- Staffle: a raffle among staff for items from Prizing. A Staffle has items (each a prize and how many winners), staff tick the items they want (one free entry per item), staff press Draw, and the winners are saved.
-- Everything is read and written by the routes (service role); RLS is on with no policies.

-- One picture per prize (shrunk in the browser to a WebP of about 120 KB), shown on the Prizing row and on the Staffle card.
alter table public.logistics_prizes add column if not exists photo text not null default '';
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prize-photos', 'prize-photos', true, 262144, array['image/webp'])
on conflict (id) do update set public = true, file_size_limit = 262144, allowed_mime_types = array['image/webp'];
create policy "prize-photos public read" on storage.objects for select using (bucket_id = 'prize-photos');

create table if not exists public.staffles (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null check (length(name) between 1 and 120),
  notes       text check (notes is null or length(notes) <= 2000),
  pickup_note text not null default 'Pick it up from Event Logistics and tell them your name.' check (length(pickup_note) <= 300),
  opens_at    timestamptz not null,
  closes_at   timestamptz not null,
  rules       jsonb not null default '{}'::jsonb,                     -- who may enter: { in: [groups], out: [groups], add: [user ids], block: [user ids] }
  status      text not null default 'open' check (status in ('open', 'drawn', 'ended', 'cancelled')),   -- open: taking entries (until closes_at); drawn: winners are picked, prizes being claimed; ended: done, unclaimed prizes are free again
  seed        text,                                                   -- the draw is computed from this, so the same seed gives the same result
  drawn_at    timestamptz,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.staffle_items (
  id         uuid primary key default gen_random_uuid(),
  staffle_id uuid not null references public.staffles(id) on delete cascade,
  prize_id   uuid not null references public.logistics_prizes(id) on delete restrict,
  winners    int not null default 1 check (winners between 1 and 500),   -- how many different people win this item
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  unique (staffle_id, prize_id)
);
create table if not exists public.staffle_entries (
  id         uuid primary key default gen_random_uuid(),
  staffle_id uuid not null references public.staffles(id) on delete cascade,
  item_id    uuid not null references public.staffle_items(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (item_id, user_id)
);
create table if not exists public.staffle_winners (
  id         uuid primary key default gen_random_uuid(),
  staffle_id uuid not null references public.staffles(id) on delete cascade,
  item_id    uuid not null references public.staffle_items(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  position   int not null,                                              -- the order the winners were drawn in
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (item_id, user_id)
);
create index if not exists staffle_items_staffle on public.staffle_items (staffle_id, sort);
create index if not exists staffle_entries_staffle on public.staffle_entries (staffle_id, user_id);
create index if not exists staffle_entries_user on public.staffle_entries (user_id);
create index if not exists staffle_winners_staffle on public.staffle_winners (staffle_id, position);
alter table public.staffles enable row level security;
alter table public.staffle_items enable row level security;
alter table public.staffle_entries enable row level security;
alter table public.staffle_winners enable row level security;

-- A winner who did not claim and was passed over (the item was drawn again): kept, so they cannot be picked again, but they hold nothing back.
alter table public.staffle_winners add column if not exists passed_at timestamptz;
