-- Word filter everywhere: every table whose text other people read gets the same check at the database, so a save from any page, route or script is covered. A changed value that hits the block list is refused; log-only and warning words are logged and let through (see wf_blocked).
-- First, wf_match reads the lists once per call instead of once per word, so a long document is checked quickly.
create or replace function public.wf_match(t text, k text default 'block') returns text
language plpgsql stable security definer set search_path = public as $$
declare
  tok text; mapped text; collapsed text; flat text := ''; src text; ph text; me uuid := auth.uid();
  allow_t text[]; mine text[]; bl text[]; blc text[]; bp text[]; i int;
begin
  if t is null or btrim(t) = '' then return null; end if;
  if exists (select 1 from public.team_settings where key = 'sw_word_filter' and value = 'off') then return null; end if;
  select coalesce(array_agg(a.term), '{}') into allow_t from public.word_filter_terms a where a.kind = 'allow';
  select coalesce(array_agg(b.term), '{}'), coalesce(array_agg(regexp_replace(b.term, '(.)\1+', '\1', 'g')), '{}') into bl, blc from public.word_filter_terms b where b.kind = k;
  select coalesce(array_agg(b.term), '{}') into bp from public.word_filter_terms b where b.kind = k and b.partial;
  mine := '{}';
  if me is not null then select coalesce(array_agg(p.term), '{}') into mine from public.word_filter_person_allow p where p.user_id = me; end if;
  src := ' ' || btrim(regexp_replace(lower(left(t, 20000)), '[^a-z0-9@$]+', ' ', 'g')) || ' ';
  foreach ph in array allow_t loop
    if position(' ' in ph) > 0 then src := replace(src, ' ' || ph || ' ', ' '); end if;
  end loop;
  for tok in select regexp_split_to_table(btrim(src), ' ') loop
    continue when tok = '' or tok !~ '[a-z]';
    mapped := translate(tok, '013457@$', 'oieastas');
    mapped := regexp_replace(mapped, '[^a-z]', '', 'g');
    continue when mapped = '';
    flat := flat || mapped;
    collapsed := regexp_replace(mapped, '(.)\1+', '\1', 'g');
    continue when mapped = any (allow_t) or collapsed = any (allow_t) or mapped = any (mine) or collapsed = any (mine);
    i := array_position(bl, mapped);
    if i is null then i := array_position(bl, collapsed); end if;
    if i is null then i := array_position(blc, collapsed); end if;
    if i is not null then return bl[i]; end if;
  end loop;
  foreach ph in array bp loop
    if position(ph in flat) > 0 then return ph; end if;
  end loop;
  return null;
end $$;
revoke execute on function public.wf_match(text, text) from public, anon, authenticated;

create or replace function public.wf_row_guard() returns trigger
language plpgsql as $$
declare c text; v text; newj jsonb := to_jsonb(new); oldj jsonb;
begin
  if tg_op = 'UPDATE' then oldj := to_jsonb(old); end if;
  for i in 1 .. coalesce(array_length(tg_argv, 1), 0) - 1 loop
    c := tg_argv[i];
    v := newj ->> c;
    if v is null or v = '' then continue; end if;
    if tg_op = 'UPDATE' and (oldj ->> c) is not distinct from v then continue; end if;
    if public.wf_blocked(v, tg_argv[0]) then
      raise exception 'That contains language that is not allowed here. Please reword it.' using errcode = 'P0001', hint = 'word_filter';
    end if;
  end loop;
  return new;
end $$;

do $$
declare
  spec jsonb := '{
    "broadcast_roles": ["content","name"], "broadcasts": ["content","notes","title"], "custom_emojis": ["content","name"],
    "division_announcements": ["messages","body","title"], "division_docs": ["messages","body","title"], "division_join_requests": ["messages","message"],
    "doc_categories": ["content","name"], "doc_comments": ["messages","body"], "doc_versions": ["messages","content","note","title"],
    "docs": ["messages","content","draft_content","draft_title","title"], "home_shoutouts": ["messages","message"],
    "logistics_devices": ["content","name","notes","place_note"], "logistics_plans": ["content","name","notes"], "logistics_plan_slots": ["content","label"],
    "logistics_prizes": ["content","name","notes"], "logistics_sponsors": ["content","name","notes"], "logistics_stations": ["content","name"],
    "meeting_groups": ["content","name"], "meeting_plans": ["content","location","title"], "meeting_series": ["content","location","title"],
    "meetings": ["content","location","question","title"], "newsletter_comments": ["messages","body"], "newsletter_issues": ["content","title"],
    "newsletter_lists": ["content","name"], "photobooth_looks": ["content","name"], "photobooth_overlays": ["content","name"],
    "photobooths": ["content","name","welcome_text","welcome_title"], "poll_entries": ["content","name","subtitle"], "polls": ["content","name"],
    "qa_questions": ["messages","body"], "qa_sessions": ["content","name"], "quarter_roster": ["content","name","title"], "quick_links": ["content","note","title"],
    "reward_items": ["content","description","title"], "site_contents": ["content","description","title"], "staffles": ["content","name","notes","pickup_note"],
    "team_year_members": ["content","name","title"], "tier_definitions": ["content","name"], "tournament_entrants": ["content","name"],
    "tournament_matches": ["content","label"], "tournament_stages": ["content","name"], "tournaments": ["content","description","name"],
    "trivia_players": ["messages","name"], "trivia_questions": ["messages","text"], "trivia_quizzes": ["content","name"]
  }'::jsonb;
  tbl text; cols text;
begin
  for tbl in select jsonb_object_keys(spec) loop
    continue when to_regclass('public.' || tbl) is null;
    select string_agg(quote_literal(x), ',') into cols from jsonb_array_elements_text(spec -> tbl) x;
    execute format('drop trigger if exists wf_row_guard_trg on public.%I', tbl);
    execute format('create trigger wf_row_guard_trg before insert or update on public.%I for each row execute function public.wf_row_guard(%s)', tbl, cols);
  end loop;
end $$;
