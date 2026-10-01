-- Event reminders: track what's been sent per ticket so the cron job never
-- double-sends, and let people opt out of the email copy.
alter table public.tickets
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_1h_sent_at timestamptz;

alter table public.profiles
  add column if not exists email_reminders boolean not null default true;

create index if not exists tickets_reminders_pending_idx
  on public.tickets (event_id) where status = 'active' and reminder_1h_sent_at is null;
