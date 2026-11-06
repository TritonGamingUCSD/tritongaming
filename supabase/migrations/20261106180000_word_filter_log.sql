-- Word filter, round two: a log of what was refused (word, field, who, never the text), per-area modes (on, log only, off) kept in team_settings as wf_mode_<area>, words allowed for one person only, allowed phrases, and a change history that can be undone.
-- Safe to run more than once.
create table if not exists public.word_filter_log (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  area       text not null,
  field      text,
  term       text not null,
  user_id    uuid references public.profiles(id) on delete set null,
  mode       text not null default 'on',
  source     text not null default 'server'
);
create index if not exists word_filter_log_at_idx on public.word_filter_log (created_at desc);
alter table public.word_filter_log enable row level security;

create table if not exists public.word_filter_person_allow (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  term       text not null,
  added_by   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, term)
);
alter table public.word_filter_person_allow enable row level security;

create table if not exists public.word_filter_history (
  id       uuid primary key default gen_random_uuid(),
  at       timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  batch    uuid not null default gen_random_uuid(),
  action   text not null check (action in ('add', 'remove')),
  term     text not null,
  kind     text not null,
  partial  boolean not null default false,
  undone   boolean not null default false
);
create index if not exists word_filter_history_at_idx on public.word_filter_history (at desc);
alter table public.word_filter_history enable row level security;

-- Allowed words may now be phrases (letters and single spaces), so a name like "Scunthorpe United" can be allowed whole.
-- wf_match: the listed word the text hits, or null. Allowed phrases are cut out first; a word allowed for the signed-in person is skipped.
drop function if exists public.wf_blocked(text);
create or replace function public.wf_match(t text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  tok text; mapped text; collapsed text; flat text := ''; hit text; src text; ph text; me uuid := auth.uid();
begin
  if t is null or btrim(t) = '' then return null; end if;
  if exists (select 1 from public.team_settings where key = 'sw_word_filter' and value = 'off') then return null; end if;
  src := ' ' || btrim(regexp_replace(lower(t), '[^a-z0-9@$]+', ' ', 'g')) || ' ';
  for ph in select a.term from public.word_filter_terms a where a.kind = 'allow' and a.term like '% %' loop
    src := replace(src, ' ' || ph || ' ', ' ');
  end loop;
  for tok in select regexp_split_to_table(btrim(src), ' ') loop
    continue when tok = '' or tok !~ '[a-z]';
    mapped := translate(tok, '013457@$', 'oieastas');
    mapped := regexp_replace(mapped, '[^a-z]', '', 'g');
    continue when mapped = '';
    flat := flat || mapped;
    collapsed := regexp_replace(mapped, '(.)\1+', '\1', 'g');
    if exists (select 1 from public.word_filter_terms a where a.kind = 'allow' and (a.term = mapped or a.term = collapsed)) then continue; end if;
    if me is not null and exists (select 1 from public.word_filter_person_allow p where p.user_id = me and (p.term = mapped or p.term = collapsed)) then continue; end if;
    hit := null;
    select b.term into hit from public.word_filter_terms b
      where b.kind = 'block' and (b.term = mapped or b.term = collapsed or regexp_replace(b.term, '(.)\1+', '\1', 'g') = collapsed)
      limit 1;
    if hit is not null then return hit; end if;
  end loop;
  hit := null;
  select b.term into hit from public.word_filter_terms b where b.kind = 'block' and b.partial and position(b.term in flat) > 0 limit 1;
  return hit;
end $$;
revoke execute on function public.wf_match(text) from public, anon, authenticated;

-- wf_blocked: should this text be refused? Honors the area's mode (wf_mode_profiles, wf_mode_content: default on). In "log only" mode it writes the log row itself and lets the text through.
create or replace function public.wf_blocked(t text, area text default 'content') returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare m text; md text;
begin
  m := public.wf_match(t);
  if m is null then return false; end if;
  select value into md from public.team_settings where key = 'wf_mode_' || area;
  md := coalesce(md, 'on');
  if md = 'off' then return false; end if;
  if md = 'log' then
    insert into public.word_filter_log (area, term, user_id, mode, source) values (area, m, auth.uid(), 'log', 'database');
  end if;
  return md = 'on';
end $$;

create or replace function public.profiles_word_filter() returns trigger
language plpgsql as $$
begin
  if (new.display_name is distinct from old.display_name and public.wf_blocked(new.display_name, 'profiles'))
     or (new.gamer_tag is distinct from old.gamer_tag and public.wf_blocked(new.gamer_tag, 'profiles'))
     or (new.bio is distinct from old.bio and public.wf_blocked(new.bio, 'profiles'))
     or (new.org_title is distinct from old.org_title and public.wf_blocked(new.org_title, 'profiles')) then
    raise exception 'That contains language that is not allowed here. Please reword it.' using errcode = 'P0001', hint = 'word_filter';
  end if;
  return new;
end $$;
