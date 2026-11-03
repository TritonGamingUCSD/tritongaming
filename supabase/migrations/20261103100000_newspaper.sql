-- Newspaper: the club's email, written as an "issue" of blocks in the portal (Team → Newspaper), checked by a second person, and sent to an audience picked by rules (roles, divisions, teams, event attendance, people) plus public subscribers.
-- An issue has a type (the newspaper, an event announcement or an event update), a status (draft → review → sending → sent), numbered automatically, and a web copy at an unguessable address.
-- Sending snapshots who gets it into `newspaper_deliveries` (one row per person, so a batch can stop and go on, and a failure can be tried again); clicks are counted per link only, never per person.
-- Everything goes through the site's own routes (service role): the tables have row level security on and no policies, and guests are refused by the "no anonymous sessions" policy as everywhere else.
-- Additive. Safe to run once.
create table if not exists public.newspaper_lists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  rules      jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.newspaper_issue_number;

create table if not exists public.newspaper_issues (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  number         int  not null unique default nextval('public.newspaper_issue_number'),
  title          text not null check (char_length(title) between 1 and 160),
  preheader      text not null default '' check (char_length(preheader) <= 140),
  type           text not null default 'newspaper' check (type in ('newspaper', 'event_announcement', 'event_update')),
  event_id       uuid references public.events(id) on delete set null,
  blocks         jsonb not null default '[]'::jsonb,
  audience       jsonb not null default '{}'::jsonb,
  list_id        uuid references public.newspaper_lists(id) on delete set null,
  status         text not null default 'draft' check (status in ('draft', 'review', 'sending', 'sent')),
  web_token      text not null unique default replace(gen_random_uuid()::text, '-', ''),
  content_version int not null default 1,        -- goes up with every change to what the email says; a test email must match it before sending
  tested_version  int not null default 0,
  created_by     uuid references public.profiles(id) on delete set null,
  review_by      uuid references public.profiles(id) on delete set null,
  review_at      timestamptz,
  sent_by        uuid references public.profiles(id) on delete set null,
  started_at     timestamptz,
  sent_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists newspaper_issues_status_idx on public.newspaper_issues (status, updated_at desc);

create table if not exists public.newspaper_deliveries (
  id        uuid primary key default gen_random_uuid(),
  issue_id  uuid not null references public.newspaper_issues(id) on delete cascade,
  user_id   uuid references auth.users(id) on delete set null,
  subscriber_id uuid,
  name      text not null default '',
  email     text not null,
  status    text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error     text,
  sent_at   timestamptz,
  unique (issue_id, email)
);
create index if not exists newspaper_deliveries_issue_idx on public.newspaper_deliveries (issue_id, status);

create table if not exists public.newspaper_links (
  issue_id uuid not null references public.newspaper_issues(id) on delete cascade,
  n        int  not null,
  url      text not null,
  clicks   int  not null default 0,
  primary key (issue_id, n)
);

create table if not exists public.newspaper_comments (
  id         uuid primary key default gen_random_uuid(),
  issue_id   uuid not null references public.newspaper_issues(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete set null,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists newspaper_comments_issue_idx on public.newspaper_comments (issue_id, created_at);

-- Public sign-ups (people without an account). `status`: pending (waiting for the confirm link in the email we sent), active, unsubscribed. Only active ones get issues.
create table if not exists public.newspaper_subscribers (
  id           uuid primary key default gen_random_uuid(),
  email        text not null check (email = lower(email) and char_length(email) <= 254),
  name         text not null default '' check (char_length(name) <= 80),
  status       text not null default 'pending' check (status in ('pending', 'active', 'unsubscribed')),
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (email)
);

-- Add one to a link's click count (one statement, so two clicks at once are both counted).
create or replace function public.newspaper_click(p_issue uuid, p_n int) returns text
language sql security definer set search_path = public as $$
  update public.newspaper_links set clicks = clicks + 1 where issue_id = p_issue and n = p_n returning url;
$$;
revoke all on function public.newspaper_click(uuid, int) from public, anon, authenticated;

alter table public.newspaper_lists enable row level security;
alter table public.newspaper_issues enable row level security;
alter table public.newspaper_deliveries enable row level security;
alter table public.newspaper_links enable row level security;
alter table public.newspaper_comments enable row level security;
alter table public.newspaper_subscribers enable row level security;

do $$
declare t text;
begin
  foreach t in array array['newspaper_lists', 'newspaper_issues', 'newspaper_deliveries', 'newspaper_links', 'newspaper_comments', 'newspaper_subscribers'] loop
    execute format('drop policy if exists "no anonymous sessions" on public.%I', t);
    execute format($p$create policy "no anonymous sessions" on public.%I as restrictive for all to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false) with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)$p$, t);
  end loop;
end $$;

-- (added the same day, before any use) a batch claims the deliveries it is about to send, so two pages sending at once never send one twice.
alter table public.newspaper_deliveries add column if not exists claimed_at timestamptz;
