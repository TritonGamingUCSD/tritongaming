-- Word filter: read through evasions. Digits and symbols for letters (b00b, sh1t, a$$, sh!t), stretched letters (fuuuck), letters split by spaces or marks (b o o b, b/oob, bo ob, f-u-c-k), accents, invisible characters and look-alike Cyrillic/Greek letters. Short pieces are joined, never across an apostrophe (he'll is not hell).
-- A plain short word never matches a longer blocked word that squashes to it (as / ass). Same rules as src/lib/wordfilter/filter.ts. Safe to run more than once.
create or replace function public.wf_word(mp text, allow_t text[], mine text[], bl text[], blc text[]) returns text
language plpgsql immutable set search_path = public as $$
declare c text := regexp_replace(mp, '(.)\1+', '\1', 'g'); i int;
begin
  if mp = any (allow_t) or c = any (allow_t) or mp = any (mine) or c = any (mine) then return null; end if;
  i := array_position(bl, mp);
  if i is null then i := array_position(bl, c); end if;
  if i is null and c <> mp then i := array_position(blc, c); end if;
  if i is null then return null; end if;
  return bl[i];
end $$;
revoke execute on function public.wf_word(text, text[], text[], text[], text[]) from public, anon, authenticated;

create or replace function public.wf_match(t text, k text default 'block') returns text
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid(); allow_t text[]; mine text[]; bl text[]; blc text[]; bp text[];
  src text; ph text; raws text[]; mp text[]; n int; i int; j int; acc text; cnt int; flat text := ''; hit text;
begin
  if t is null or btrim(t) = '' then return null; end if;
  if exists (select 1 from public.team_settings where key = 'sw_word_filter' and value = 'off') then return null; end if;
  select coalesce(array_agg(a.term), '{}') into allow_t from public.word_filter_terms a where a.kind = 'allow';
  select coalesce(array_agg(b.term), '{}'), coalesce(array_agg(regexp_replace(b.term, '(.)\1+', '\1', 'g')), '{}') into bl, blc from public.word_filter_terms b where b.kind = k;
  select coalesce(array_agg(b.term), '{}') into bp from public.word_filter_terms b where b.kind = k and b.partial;
  mine := '{}';
  if me is not null then select coalesce(array_agg(p.term), '{}') into mine from public.word_filter_person_allow p where p.user_id = me; end if;

  src := lower(left(t, 20000));
  src := regexp_replace(src, '[' || chr(8203) || '-' || chr(8207) || chr(8288) || chr(65279) || chr(173) || ']', '', 'g');
  src := translate(src, 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy');
  src := translate(src, 'асеорхуіѕјαονρικ', 'aceopxyisjaovpik');
  src := regexp_replace(src, '([a-z0-9])!(?=[a-z0-9])', '\1i', 'g');
  src := replace(replace(replace(src, '''', ' ~ '), '’', ' ~ '), '`', ' ~ ');
  src := ' ' || btrim(regexp_replace(src, '[^a-z0-9@$+~]+', ' ', 'g')) || ' ';
  foreach ph in array allow_t loop
    if position(' ' in ph) > 0 then src := replace(src, ' ' || ph || ' ', ' '); end if;
  end loop;
  raws := string_to_array(btrim(src), ' ');
  n := coalesce(array_length(raws, 1), 0);
  mp := array_fill(''::text, array[greatest(n, 1)]);
  for i in 1 .. n loop
    if raws[i] = '~' then mp[i] := '~';
    else mp[i] := regexp_replace(translate(raws[i], '013457@$+', 'oieastast'), '[^a-z]', '', 'g');
    end if;
  end loop;

  for i in 1 .. n loop
    continue when mp[i] = '~' or mp[i] = '' or raws[i] !~ '[a-z]';
    flat := flat || mp[i];
    hit := public.wf_word(mp[i], allow_t, mine, bl, blc);
    if hit is not null then return hit; end if;
  end loop;

  for i in 1 .. n loop
    acc := ''; cnt := 0;
    for j in i .. n loop
      exit when cnt >= 8;
      exit when mp[j] = '~';
      continue when mp[j] = '';
      exit when length(mp[j]) > 4;
      acc := acc || mp[j];
      cnt := cnt + 1;
      exit when length(acc) > 24;
      if cnt >= 2 then
        hit := public.wf_word(acc, allow_t, mine, bl, blc);
        if hit is not null then return hit; end if;
      end if;
    end loop;
  end loop;

  foreach ph in array bp loop
    if position(ph in flat) > 0 then return ph; end if;
  end loop;
  return null;
end $$;
revoke execute on function public.wf_match(text, text) from public, anon, authenticated;

-- one more plain word that was only listed in the plural
insert into public.word_filter_terms (term, kind, partial, builtin)
select translate(w, 'abcdefghijklmnopqrstuvwxyz', 'nopqrstuvwxyzabcdefghijklm'), 'block', false, true
from unnest(string_to_array('obbo', ',')) as w
where not exists (select 1 from public.word_filter_terms x where x.term = translate(w, 'abcdefghijklmnopqrstuvwxyz', 'nopqrstuvwxyzabcdefghijklm') and x.kind = 'block')
on conflict (term, kind) do nothing;
delete from public.word_filter_terms where kind = 'warn' and term = 'boob';
