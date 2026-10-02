-- Which people already got a reminder for which meeting / internal event occurrence, so the reminder job can be run
-- as often as you like without sending twice. item_key examples: "meeting:<id>", "series:<id>|<date>", "internal:<id>".
create table if not exists public.reminders_sent (
  item_key  text not null,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  sent_at   timestamptz not null default now(),
  primary key (item_key, user_id)
);
alter table public.reminders_sent enable row level security;
