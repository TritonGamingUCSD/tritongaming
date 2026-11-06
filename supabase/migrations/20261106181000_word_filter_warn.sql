-- Word filter: a second list of words that only warn (the text is saved and the use is flagged in the log), beside the list that refuses.
alter table public.word_filter_terms drop constraint if exists word_filter_terms_kind_check;
alter table public.word_filter_terms add constraint word_filter_terms_kind_check check (kind in ('block', 'warn', 'allow'));
alter table public.word_filter_log drop constraint if exists word_filter_log_mode_check;
drop function if exists public.wf_match(text);
create or replace function public.wf_match(t text, k text default 'block') returns text
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
      where b.kind = k and (b.term = mapped or b.term = collapsed or regexp_replace(b.term, '(.)\1+', '\1', 'g') = collapsed)
      limit 1;
    if hit is not null then return hit; end if;
  end loop;
  hit := null;
  select b.term into hit from public.word_filter_terms b where b.kind = k and b.partial and position(b.term in flat) > 0 limit 1;
  return hit;
end $$;
revoke execute on function public.wf_match(text, text) from public, anon, authenticated;

create or replace function public.wf_blocked(t text, area text default 'content') returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare m text; md text;
begin
  select value into md from public.team_settings where key = 'wf_mode_' || area;
  md := coalesce(md, 'on');
  if md = 'off' then return false; end if;
  m := public.wf_match(t, 'block');
  if m is null then
    m := public.wf_match(t, 'warn');
    if m is not null then
      insert into public.word_filter_log (area, term, user_id, mode, source) values (area, m, auth.uid(), 'warn', 'database');
    end if;
    return false;
  end if;
  if md = 'log' then
    insert into public.word_filter_log (area, term, user_id, mode, source) values (area, m, auth.uid(), 'log', 'database');
  end if;
  return md = 'on';
end $$;
