-- Help tickets: any signed-in member can ask for help; exec and admin answer them in the portal.
-- All reads/writes go through API routes with the service role (those routes are the real boundary);
-- RLS only lets a person read their own rows directly.
create table if not exists public.help_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  category    text not null default 'other' check (category in ('bug','question','account','tickets','other')),
  subject     text not null,
  status      text not null default 'open' check (status in ('open','in_progress','resolved')),
  assigned_to uuid references public.profiles(id) on delete set null,
  page        text,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  resolved_at timestamptz,
  -- Last message from the person who asked (true) or from staff (false): drives "needs reply" and "new reply".
  last_from_user boolean not null default true
);
create index if not exists help_tickets_status_idx on public.help_tickets (status, updated_at desc);
create index if not exists help_tickets_user_idx on public.help_tickets (user_id, updated_at desc);

create table if not exists public.help_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.help_tickets(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  body        text not null,
  -- Storage paths in the private help-attachments bucket; shown through short-lived signed links.
  attachments text[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists help_messages_ticket_idx on public.help_messages (ticket_id, created_at);

alter table public.help_tickets enable row level security;
alter table public.help_messages enable row level security;

drop policy if exists "help_tickets owner read" on public.help_tickets;
create policy "help_tickets owner read" on public.help_tickets for select using (auth.uid() = user_id);
drop policy if exists "help_messages owner read" on public.help_messages;
create policy "help_messages owner read" on public.help_messages for select
  using (exists (select 1 from public.help_tickets t where t.id = ticket_id and t.user_id = auth.uid()));

-- Screenshots: private bucket, each person uploads into their own folder; reads happen through signed
-- links created by the API (staff and the ticket's owner only).
insert into storage.buckets (id, name, public) values ('help-attachments', 'help-attachments', false)
on conflict (id) do nothing;
drop policy if exists "help-attachments own insert" on storage.objects;
create policy "help-attachments own insert" on storage.objects for insert
  with check (bucket_id = 'help-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
