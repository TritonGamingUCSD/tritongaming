-- Strike tracker. Private: only the person, exec, admin and anyone given the "manage strikes" access (the HR team) can ever see it.
-- No client access (no policies): everything goes through the server, which checks who is asking.
--
-- A strike starts as a DRAFT (only HR sees it), and shows on the person's own screen once HR PUBLISHES it. Published strikes can be taken away
-- (removed by HR) or removed with a voucher. Nothing here is automatic: attendance only ever produces suggestions for HR to review.
create table if not exists public.strikes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'draft' check (status in ('draft', 'published', 'removed')),
  reason        text not null,
  incident_date date not null,
  meeting_id    uuid references public.meetings(id) on delete set null,   -- set when it came from a missed meeting
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  published_by  uuid references auth.users(id) on delete set null,
  published_at  timestamptz,
  removed_by    uuid references auth.users(id) on delete set null,
  removed_at    timestamptz,
  removed_how   text check (removed_how in ('taken', 'voucher')),
  removed_note  text,
  voucher_id    uuid
);
create index if not exists strikes_user on public.strikes (user_id, status);
-- One strike per person per missed meeting, so the same absence can't be struck twice.
create unique index if not exists strikes_one_per_meeting on public.strikes (user_id, meeting_id) where meeting_id is not null;
alter table public.strikes enable row level security;

create table if not exists public.strike_vouchers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  reason      text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  used_at     timestamptz,
  used_on_strike_id uuid references public.strikes(id) on delete set null,
  used_by     uuid references auth.users(id) on delete set null
);
create index if not exists strike_vouchers_user on public.strike_vouchers (user_id);
alter table public.strike_vouchers enable row level security;

-- Missed meetings HR looked at and decided are not strikes, so they stop being suggested.
create table if not exists public.strike_dismissals (
  user_id      uuid not null references auth.users(id) on delete cascade,
  meeting_id   uuid not null references public.meetings(id) on delete cascade,
  dismissed_by uuid references auth.users(id) on delete set null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, meeting_id)
);
alter table public.strike_dismissals enable row level security;

-- Suggestions only look at meetings from this day on, so switching the tracker on doesn't flood HR with old absences.
create table if not exists public.strike_settings (key text primary key, value text not null);
alter table public.strike_settings enable row level security;
insert into public.strike_settings (key, value) values ('suggest_from', (now() at time zone 'America/Los_Angeles')::date::text) on conflict (key) do nothing;
