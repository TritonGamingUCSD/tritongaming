-- In-portal notification center. Until now the only way to know "did my
-- ticket go through" or "did my roles change" was to notice it yourself —
-- the activity feed only shows a user their own history if they go look for
-- it. This is a real inbox: rows are written by trusted server-side code
-- (API routes with a service-role client, or the security-definer
-- admin_set_user_roles function below) and never directly by a client, so
-- there's no insert policy for regular users at all.

begin;

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  href        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- The bell's two real queries: "give me this user's recent notifications"
-- (ordered, limited) and "how many are unread" (a partial index keeps that
-- count cheap even once old read notifications pile up).
create index notifications_user_id_created_at_idx on public.notifications (user_id, created_at desc);
create index notifications_user_id_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications readable by owner"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Marking as read is the only client-initiated write, and only ever to your
-- own rows.
create policy "notifications updatable by owner"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
