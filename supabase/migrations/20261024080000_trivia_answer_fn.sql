-- Taking an answer in ONE database call that cannot race the host. It checks the game is still on that question (and the clock, with a short grace), holds the game row for the length of the
-- statement so the host's reveal / end (which updates that row) waits for it, and only then stores the answer. So an answer is either in before the reveal counts the scores, or refused as closed:
-- never stored but left out of the totals. Points: 1000 for an instant right answer down to 500 at the last second (the same as lib/trivia/game.ts pointsFor).
-- Called only by the routes (service role).
create or replace function public.trivia_submit_answer(p_game uuid, p_user uuid, p_q int, p_pos int, p_grace_ms int)
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
  answered int;
  players int;
begin
  select status, current, plan, q_started_at, q_ends_at into g from public.trivia_games where id = p_game for share;
  if not found then return jsonb_build_object('gone', true); end if;
  if g.status <> 'question' or g.current <> p_q or g.q_started_at is null or g.q_ends_at is null
     or clock_timestamp() > g.q_ends_at + make_interval(secs => p_grace_ms / 1000.0) then
    return jsonb_build_object('closed', true);
  end if;
  select status into pl from public.trivia_players where game_id = p_game and user_id = p_user;
  if not found or pl.status <> 'in' then return jsonb_build_object('out', true); end if;
  q := g.plan -> p_q;
  if q is null or p_pos < 0 or p_pos >= jsonb_array_length(q -> 'choices') then return jsonb_build_object('bad', true); end if;
  secs := (q ->> 'secs')::int;
  ms := greatest(0, floor(extract(epoch from (clock_timestamp() - g.q_started_at)) * 1000))::int;
  right_ := p_pos = (q ->> 'correct')::int;
  pts := case when right_ then round(1000 * (1 - least(ms, secs * 1000)::numeric / (secs * 1000) / 2))::int else 0 end;
  insert into public.trivia_answers (game_id, user_id, q_index, pos, ok, ms, points)
    values (p_game, p_user, p_q, p_pos, right_, ms, pts)
    on conflict (game_id, user_id, q_index) do nothing;
  get diagnostics inserted = row_count;
  select pos into first_pos from public.trivia_answers where game_id = p_game and user_id = p_user and q_index = p_q;
  select count(*) into answered from public.trivia_answers where game_id = p_game and q_index = p_q;
  select count(*) into players from public.trivia_players where game_id = p_game and status = 'in';
  return jsonb_build_object('first', inserted > 0, 'pos', first_pos, 'answered', answered, 'players', players);
end;
$$;
revoke all on function public.trivia_submit_answer(uuid, uuid, int, int, int) from public, anon, authenticated;
grant execute on function public.trivia_submit_answer(uuid, uuid, int, int, int) to service_role;
