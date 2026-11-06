-- Word filter: a list of blocked and allowed words, and a check used by the database itself (for pages that save straight to the database, like a profile) and by the server routes.
-- The built-in list is stored lightly encoded (rot13) in this file so reading the repository is not unpleasant; it is decoded as it is inserted. Whole-word matching, so harmless words that contain a short one are never caught (the Scunthorpe problem).
-- Safe to run once.
create table if not exists public.word_filter_terms (
  term       text not null,
  kind       text not null check (kind in ('block', 'allow')),
  partial    boolean not null default false, -- block inside longer words too (for words that are never innocent)
  builtin    boolean not null default false,
  added_by   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (term, kind)
);
alter table public.word_filter_terms enable row level security;

insert into public.word_filter_terms (term, kind, partial, builtin)
select translate(w, 'abcdefghijklmnopqrstuvwxyz', 'nopqrstuvwxyzabcdefghijklm'), 'block', false, true
from unnest(string_to_array('shpx,shpxre,shpxvat,shpxrq,fuvg,fuvggl,ovgpu,onfgneq,nffubyr,phag,qvpx,qvpxurnq,chffl,juber,fyhg,pbpx,gjng,jnaxre,obyybpxf,zbgureshpxre,cevpx,qbhpur,qbhpuront,qhzonff,wnpxnff,cvff,avttn,snt,ergneq,ergneqrq,xvxr,puvax,fcvp,pbba,tbbx,qlxr,cnxv,ornare,xlf', ',')) as w
on conflict do nothing;
insert into public.word_filter_terms (term, kind, partial, builtin)
select translate(w, 'abcdefghijklmnopqrstuvwxyz', 'nopqrstuvwxyzabcdefghijklm'), 'block', true, true
from unnest(string_to_array('avttre,snttbg,genaal,jrgonpx,gbjryurnq,enturnq,xvyylbhefrys', ',')) as w
on conflict (term, kind) do update set partial = true;

-- The check. Letters only count; digits and @ $ inside a word are read as letters (f4ck, sh1t); repeated letters collapse (fuuuck). Returns true when the text should be refused.
create or replace function public.wf_blocked(t text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  tok text; mapped text; collapsed text; flat text := '';
  hit boolean;
begin
  if t is null or btrim(t) = '' then return false; end if;
  if exists (select 1 from public.team_settings where key = 'sw_word_filter' and value = 'off') then return false; end if;
  for tok in select regexp_split_to_table(lower(t), '[^a-z0-9@$]+') loop
    continue when tok = '' or tok !~ '[a-z]';
    mapped := translate(tok, '013457@$', 'oieastas');
    mapped := regexp_replace(mapped, '[^a-z]', '', 'g');
    continue when mapped = '';
    flat := flat || mapped;
    collapsed := regexp_replace(mapped, '(.)\1+', '\1', 'g');
    if exists (select 1 from public.word_filter_terms a where a.kind = 'allow' and (a.term = mapped or a.term = collapsed)) then continue; end if;
    select true into hit from public.word_filter_terms b
      where b.kind = 'block' and (b.term = mapped or b.term = collapsed or regexp_replace(b.term, '(.)\1+', '\1', 'g') = collapsed)
      limit 1;
    if hit then return true; end if;
  end loop;
  -- words that are never innocent are also caught inside longer text and with spaces between the letters
  select true into hit from public.word_filter_terms b where b.kind = 'block' and b.partial and position(b.term in flat) > 0 limit 1;
  return coalesce(hit, false);
end $$;

-- Profiles are saved straight to the database from the browser, so the database refuses a blocked name, tag, title or bio when it is changed (an unchanged value is never re-checked, so nobody is locked out by an old name).
create or replace function public.profiles_word_filter() returns trigger
language plpgsql as $$
begin
  if (new.display_name is distinct from old.display_name and public.wf_blocked(new.display_name))
     or (new.gamer_tag is distinct from old.gamer_tag and public.wf_blocked(new.gamer_tag))
     or (new.bio is distinct from old.bio and public.wf_blocked(new.bio))
     or (new.org_title is distinct from old.org_title and public.wf_blocked(new.org_title)) then
    raise exception 'That contains language that is not allowed here. Please reword it.' using errcode = 'P0001', hint = 'word_filter';
  end if;
  return new;
end $$;
drop trigger if exists profiles_word_filter_trg on public.profiles;
create trigger profiles_word_filter_trg before update on public.profiles for each row execute function public.profiles_word_filter();
