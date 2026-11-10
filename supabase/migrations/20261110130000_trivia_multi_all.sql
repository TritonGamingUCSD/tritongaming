-- Trivia, questions with several right answers: a quiz can ask the players to choose ALL the right answers (multi_all) instead of any one of them. A game's plan marks such a question with "all": true;
-- the player's picks are kept in `picks`, and an answer counts as right only when the set of picks is exactly the set of right answers. The old 5-argument function stays until the site that calls it is gone.
alter table public.trivia_quizzes add column if not exists multi_all boolean not null default false;
alter table public.trivia_answers add column if not exists picks jsonb;

create or replace function public.trivia_submit_answer(p_game uuid, p_user uuid, p_q int, p_pos int, p_grace_ms int, p_picks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  pl record;
  q jsonb;
  secs int;
  ms int;
  right_ boolean;
  pts int;
  inserted int;
  first_pos int;
  first_picks jsonb;
  answered int;
  players int;
  want jsonb;
  have jsonb;
  n int;
begin
  select status, current, plan, q_started_at, q_ends_at into g from public.trivia_games where id = p_game for share;
  if not found then return jsonb_build_object('gone', true); end if;
  if g.status <> 'question' or g.current <> p_q or g.q_started_at is null or g.q_ends_at is null
     or clock_timestamp() < g.q_started_at - interval '500 milliseconds'
     or clock_timestamp() > g.q_ends_at + make_interval(secs => p_grace_ms / 1000.0) then
    return jsonb_build_object('closed', true);
  end if;
  select status into pl from public.trivia_players where game_id = p_game and user_id = p_user;
  if not found or pl.status <> 'in' then return jsonb_build_object('out', true); end if;
  q := g.plan -> p_q;
  n := case when q is null then 0 else jsonb_array_length(q -> 'choices') end;
  if q is null then return jsonb_build_object('bad', true); end if;
  secs := (q ->> 'secs')::int;
  ms := greatest(0, floor(extract(epoch from (clock_timestamp() - g.q_started_at)) * 1000))::int;
  if coalesce((q ->> 'all')::boolean, false) then
    -- choose all the right ones: the picks must be a non-empty list of valid positions, and equal the set of right answers
    if p_picks is null or jsonb_typeof(p_picks) <> 'array' or jsonb_array_length(p_picks) = 0 or jsonb_array_length(p_picks) > n then return jsonb_build_object('bad', true); end if;
    select jsonb_agg(distinct v order by v) into have from (select (jsonb_array_elements_text(p_picks))::int v) s;
    if exists (select 1 from jsonb_array_elements(have) x where (x #>> '{}')::int < 0 or (x #>> '{}')::int >= n) then return jsonb_build_object('bad', true); end if;
    select jsonb_agg(distinct v order by v) into want from (select (q ->> 'correct')::int v union select (jsonb_array_elements_text(coalesce(q -> 'also', '[]'::jsonb)))::int) s;
    right_ := have = want;
    p_pos := (have ->> 0)::int;
  else
    if p_pos < 0 or p_pos >= n then return jsonb_build_object('bad', true); end if;
    right_ := p_pos = (q ->> 'correct')::int or coalesce((q -> 'also') @> to_jsonb(p_pos), false);
    have := null;
  end if;
  pts := case when right_ then round(1000 * (1 - least(ms, secs * 1000)::numeric / (secs * 1000) / 2))::int else 0 end;
  insert into public.trivia_answers (game_id, user_id, q_index, pos, ok, ms, points, picks)
    values (p_game, p_user, p_q, p_pos, right_, ms, pts, have)
    on conflict (game_id, user_id, q_index) do nothing;
  get diagnostics inserted = row_count;
  select pos, picks into first_pos, first_picks from public.trivia_answers where game_id = p_game and user_id = p_user and q_index = p_q;
  select count(*) into answered from public.trivia_answers where game_id = p_game and q_index = p_q;
  select count(*) into players from public.trivia_players where game_id = p_game and status = 'in';
  return jsonb_build_object('first', inserted > 0, 'pos', first_pos, 'picks', first_picks, 'answered', answered, 'players', players);
end;
$$;
revoke all on function public.trivia_submit_answer(uuid, uuid, int, int, int, jsonb) from public, anon, authenticated;
grant execute on function public.trivia_submit_answer(uuid, uuid, int, int, int, jsonb) to service_role;
