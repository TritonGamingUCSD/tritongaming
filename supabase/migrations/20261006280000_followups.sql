-- Follow-ups to swap/cover, help, shifts and docs.
-- 1. Cover requests: remember when exec was told that one is still open (3 hours after, and again shortly before the shift).
alter table public.shift_cover_requests add column if not exists alerted_at timestamptz, add column if not exists alerted_final_at timestamptz;

-- 2. Help: a "Doc problem" category, for reports from a doc's menu.
alter table public.help_tickets drop constraint if exists help_tickets_category_check;
alter table public.help_tickets add constraint help_tickets_category_check check (category in ('bug','question','account','tickets','doc','other'));

-- 3. Shift hand-off notes: what the person leaving a station wants the next one to know, shown at the top of that station's guide for the event.
create table public.shift_handoff_notes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  station_id uuid not null references public.shift_stations(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index shift_handoff_idx on public.shift_handoff_notes (event_id, station_id, created_at desc);
alter table public.shift_handoff_notes enable row level security;   -- the routes use the service role

-- 4. Doc comments: a simple thread under each doc.
create table public.doc_comments (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.docs(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null
);
create index doc_comments_doc_idx on public.doc_comments (doc_id, created_at);
alter table public.doc_comments enable row level security;   -- the routes use the service role
