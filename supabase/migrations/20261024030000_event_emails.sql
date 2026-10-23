-- Event emails: what a member opted out of, and a record of each send.
-- profiles.email_reminders (event reminders) and profiles.email_notifications (event updates and announcements) already exist and were never used; the two new switches are the
-- newsletter and a master "all club emails". Everything defaults to on; an opt-out is never overridden.
alter table public.profiles add column if not exists email_newsletter boolean not null default true;
alter table public.profiles add column if not exists email_all boolean not null default true;

create table if not exists public.event_emails (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events(id) on delete cascade,
  kind             text not null check (kind in ('reminders', 'updates', 'newsletter')),
  subject          text not null check (length(subject) <= 200),
  note             text check (note is null or length(note) <= 2000),
  cover            boolean not null default true,   -- whether the event's cover picture was shown
  sent_by          uuid references auth.users(id) on delete set null,
  sent_at          timestamptz not null default now(),
  recipients       int not null default 0,   -- people who were sent to (after opt-outs)
  sent             int not null default 0,
  failed           int not null default 0,
  skipped_optout   int not null default 0,
  skipped_no_email int not null default 0
);
create index if not exists event_emails_event on public.event_emails (event_id, sent_at desc);
create index if not exists event_emails_day on public.event_emails (sent_at);
alter table public.event_emails enable row level security;   -- no policies: only the server (service role) reads and writes it
