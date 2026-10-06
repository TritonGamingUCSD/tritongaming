-- Someone exempt from the shift requirement for one event (they have a dedicated job that event). Separate from the inactive role; they can still sign up.
create table if not exists public.shift_exemptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  note text check (note is null or char_length(note) <= 160),
  marked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
alter table public.shift_exemptions enable row level security;
