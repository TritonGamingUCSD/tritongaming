-- Q&A wall: a live question session run from the portal (Q&A section) and asked into from phones by anyone with the 6-digit code, no account needed (guests sign in anonymously, like Trivia players and poll voters).
-- Guests send questions (an optional first name, or anonymous); the host approves each one before the room sees it; guests like the approved ones; the host puts one on the big screen at a time (`spotlight_id`) and marks it answered.
-- `status` of a session: draft (set up, no code), open (taking questions, has the code), closed (no new questions or likes; the code is kept).
-- `status` of a question: pending (waiting for the host), approved (everyone sees it), hidden (the host kept it off the screen), answered.
-- Everything goes through the site's own routes (service role): the tables have row level security on and no policies, so no browser can read or write them directly, and guests are refused by the "no anonymous sessions" policy as everywhere else.
-- Additive. Safe to run once.
create table if not exists public.qa_sessions (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null check (char_length(name) between 1 and 80),
  status       text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  code         text unique check (code is null or code ~ '^[0-9]{6}$'),
  spotlight_id uuid,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  opened_at    timestamptz,
  closed_at    timestamptz
);

create table if not exists public.qa_questions (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.qa_sessions(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 280),
  author      text not null default '' check (char_length(author) <= 40),
  user_id     uuid references auth.users(id) on delete set null,   -- who asked (a guest's temporary session, or an account); kept only to count a person's questions and show them their own
  status      text not null default 'pending' check (status in ('pending', 'approved', 'hidden', 'answered')),
  created_at  timestamptz not null default now(),
  answered_at timestamptz
);

create table if not exists public.qa_likes (
  question_id uuid not null references public.qa_questions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (question_id, user_id)
);

do $$ begin
  alter table public.qa_sessions add constraint qa_sessions_spotlight_fk foreign key (spotlight_id) references public.qa_questions(id) on delete set null;
exception when duplicate_object then null; end $$;

create index if not exists qa_questions_session_idx on public.qa_questions (session_id, status, created_at);
create index if not exists qa_questions_user_idx on public.qa_questions (session_id, user_id);

alter table public.qa_sessions enable row level security;
alter table public.qa_questions enable row level security;
alter table public.qa_likes enable row level security;

-- Guests (anonymous sign-ins) are refused on every table (see 20261024130000_block_anonymous.sql); a new table needs the same line.
do $$
declare t text;
begin
  foreach t in array array['qa_sessions', 'qa_questions', 'qa_likes'] loop
    execute format('drop policy if exists "no anonymous sessions" on public.%I', t);
    execute format($p$create policy "no anonymous sessions" on public.%I as restrictive for all to authenticated using (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false) with check (coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false)$p$, t);
  end loop;
end $$;
