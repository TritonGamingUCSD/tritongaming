-- Staffle: a prize nobody (or too few) entered is still given out. People can say "I'll take anything left" (kept here), and after the main draw any open spot is filled from them first, then from everyone else who may enter and has not won.
-- A winner remembers how they won ('entered' the prize or 'leftover'). Additive. Safe to run once.
create table if not exists public.staffle_anything (
  staffle_id uuid not null references public.staffles(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (staffle_id, user_id)
);
alter table public.staffle_anything enable row level security;
alter table public.staffle_winners add column if not exists via text not null default 'entered' check (via in ('entered', 'leftover'));
