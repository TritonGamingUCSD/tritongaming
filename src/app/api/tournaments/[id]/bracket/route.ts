import { NextResponse } from 'next/server';
import { withTournament } from '@/lib/tournaments/server';
import { report, undo, swissRound, swissRounds, type Match } from '@/lib/tournaments/bracket';
import { engineKey, saveMatches, toMatch, toRow } from '@/lib/tournaments/store';
import { bestOfOf, currentStage, defOf, heatRowsFor, refreshStatus, stageEngineMatches, stageField, startStage } from '@/lib/tournaments/run';
import { dealHeats, pointsStandings, scoreHeat, type HeatSlot } from '@/lib/tournaments/points';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

type Game = { a: number; b: number; map?: string; pick_a?: string; pick_b?: string };
type Body = {
  action?: 'start' | 'start-stage' | 'report' | 'undo' | 'next-round' | 'station' | 'live' | 'reset' | 'game' | 'undo-game' | 'report-heat' | 'add-match';
  key?: string;
  stage_id?: string;
  order?: string[];
  scoreA?: number;
  scoreB?: number;
  games?: Game[];
  station?: string;
  on?: boolean;
  winner?: 'a' | 'b';
  map?: string;
  a?: string;
  b?: string;
};

// Everything that moves a tournament: start it (the first stage), start a later stage from the results of the one before, enter or undo a result, deal the next Swiss round, call a match to a station, mark it live, or reset it back to registration.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as Body;
  const manageOnly = b.action === 'start' || b.action === 'start-stage' || b.action === 'reset';
  const r = await withTournament(id, manageOnly ? 'manage' : 'run');
  if ('error' in r) return r.error;
  const t = r.tournament;
  const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });
  const now = () => new Date().toISOString();

  if (b.action === 'start') {
    if (r.matches.length > 0) return bad('It has already started.', 409);
    const first = r.stages[0];
    if (!first) return bad('Add a stage first.');
    const field = stageField(r.stages, first, r.entrants, r.matches, r.stageEntrants);
    if (field.length < 2) return bad('Add at least two entrants first.');
    await Promise.all(field.map((e) => r.svc.from('tournament_entrants').update({ seed: e.seed }).eq('id', e.id)));
    try {
      const n = await startStage(r.svc, t, first, field, r.stageEntrants);
      await logAudit(r.svc, {
        actorId: r.me!.user.id,
        action: 'update',
        entityType: 'tournament',
        entityId: t.id,
        summary: `Started tournament “${t.name}” with ${field.length} entrants`,
      });
      return NextResponse.json({ ok: true, matches: n });
    } catch (e) {
      return bad(e instanceof Error ? e.message : 'Could not start.', 500);
    }
  }

  if (b.action === 'start-stage') {
    const stage = r.stages.find((s) => s.id === b.stage_id);
    if (!stage || stage.position === 1) return bad('Pick a later stage to start.');
    const prev = r.stages.find((s) => s.position === stage.position - 1)!;
    if (prev.status !== 'complete') return bad('Finish the stage before it first.', 409);
    if (stage.status !== 'pending') return bad('That stage has already started.', 409);
    let field = stageField(
      r.stages,
      stage,
      r.entrants,
      r.matches,
      r.stageEntrants.filter((x) => x.stage_id !== stage.id),
    );
    if (b.order?.length) {
      const allowed = new Set(field.map((e) => e.id));
      if (b.order.length !== allowed.size || b.order.some((x) => !allowed.has(x))) return bad('The order must list everyone moving on, once each.');
      field = b.order.map((eid, i) => ({ id: eid, seed: i + 1 }));
    }
    if (field.length < 2) return bad('Fewer than two people move on. Change the rule of the stage before.', 409);
    try {
      const n = await startStage(r.svc, t, stage, field, r.stageEntrants);
      await logAudit(r.svc, {
        actorId: r.me!.user.id,
        action: 'update',
        entityType: 'tournament',
        entityId: t.id,
        summary: `Started stage “${stage.name}” of “${t.name}” with ${field.length} entrants`,
      });
      return NextResponse.json({ ok: true, matches: n });
    } catch (e) {
      return bad(e instanceof Error ? e.message : 'Could not start the stage.', 500);
    }
  }

  if (b.action === 'reset') {
    await r.svc.from('tournament_matches').delete().eq('tournament_id', t.id);
    for (const s of r.stages) {
      await r.svc.from('tournament_stage_entrants').delete().eq('stage_id', s.id);
      await r.svc.from('tournament_stages').update({ status: 'pending' }).eq('id', s.id);
    }
    await r.svc.from('tournaments').update({ status: 'registration', signups_open: false, updated_at: now() }).eq('id', t.id);
    await logAudit(r.svc, { actorId: r.me!.user.id, action: 'update', entityType: 'tournament', entityId: t.id, summary: `Reset tournament “${t.name}” back to registration` });
    return NextResponse.json({ ok: true });
  }

  if (t.status !== 'live' && t.status !== 'complete') return bad('The tournament has not started.', 409);

  if (b.action === 'next-round') {
    const stage = r.stages.find((s) => s.id === b.stage_id) ?? currentStage(r.stages);
    if (stage && stage.format === 'points') {
      const rows = r.matches.filter((m) => m.stage_id === stage.id);
      const played = Math.max(0, ...rows.map((m) => m.round));
      const total = stage.settings.rounds ?? 3;
      if (rows.some((m) => m.status !== 'done')) return bad('Score every heat of this round first.', 409);
      if (played >= total) return bad('That was the last round.', 409);
      const ids = r.stageEntrants.filter((x) => x.stage_id === stage.id).map((x) => x.entrant_id);
      const standing = pointsStandings(
        ids,
        rows.map((m) => (m.heat ?? []) as HeatSlot[]),
      ).map((x) => x.id);
      const heats = dealHeats(standing, stage.settings.heat_size ?? 4);
      const { error } = await r.svc.from('tournament_matches').insert(heatRowsFor(t.id, stage, heats, played + 1));
      if (error) return bad('Could not deal the next round.', 500);
      await r.svc.from('tournament_stages').update({ status: 'live' }).eq('id', stage.id);
      if (t.status === 'complete') await r.svc.from('tournaments').update({ status: 'live', updated_at: now() }).eq('id', t.id);
      return NextResponse.json({ ok: true, round: played + 1 });
    }
    if (!stage || stage.format !== 'swiss') return bad('Only a Swiss or points stage has rounds to deal.');
    const mine = stageEngineMatches(r.matches, stage);
    const ids = r.stageEntrants.filter((x) => x.stage_id === stage.id).map((x) => x.entrant_id);
    const total = stage.settings.swiss_rounds ?? swissRounds(ids.length);
    const played = Math.max(0, ...mine.map((m) => m.round));
    if (mine.some((m) => m.status === 'ready' || m.status === 'pending')) return bad('Finish this round first.', 409);
    if (played >= total) return bad('That was the last round.', 409);
    const made = swissRound(ids, mine, played + 1);
    for (const m of made) {
      // The odd player's bye counts as a win at once; every other pairing is ready to play.
      if (m.b === 'BYE') {
        m.status = 'bye';
        m.winner = 'a';
      } else m.status = 'ready';
    }
    await r.svc.from('tournament_matches').insert(made.map((m) => toRow(t.id, stage, m, { best_of: stage.settings.best_of ?? null })));
    await r.svc.from('tournament_stages').update({ status: 'live' }).eq('id', stage.id);
    if (t.status === 'complete') await r.svc.from('tournaments').update({ status: 'live', updated_at: now() }).eq('id', t.id);
    return NextResponse.json({ ok: true, round: played + 1 });
  }

  // A custom stage: add one match by hand, { stage_id, a, b } (two entrants of the tournament).
  if (b.action === 'add-match') {
    const stage = r.stages.find((s) => s.id === b.stage_id);
    if (!stage || stage.format !== 'custom') return bad('Matches are added by hand only in a custom stage.');
    const ids = new Set(r.entrants.filter((e) => !e.dropped).map((e) => e.id));
    if (!b.a || !b.b || b.a === b.b || !ids.has(b.a) || !ids.has(b.b)) return bad('Pick two different entrants.');
    const n = r.matches.filter((m) => m.stage_id === stage.id).length + 1;
    const { error } = await r.svc.from('tournament_matches').insert({
      tournament_id: t.id,
      stage_id: stage.id,
      group_no: null,
      key: `s${stage.position}/C${n}`,
      bracket: 'RR',
      round: 1,
      idx: n,
      a: b.a,
      b: b.b,
      score_a: null,
      score_b: null,
      winner: null,
      status: 'ready',
      win_to: null,
      lose_to: null,
    });
    if (error) return bad('Could not add the match.', 500);
    // the stage and the tournament are playing now (they may have finished before this match was added)
    await r.svc.from('tournament_stages').update({ status: 'live' }).eq('id', stage.id);
    if (t.status === 'complete') await r.svc.from('tournaments').update({ status: 'live', updated_at: now() }).eq('id', t.id);
    return NextResponse.json({ ok: true, key: `s${stage.position}/C${n}` });
  }

  const row = r.matches.find((m) => m.key === b.key);
  if (!row) return bad('That match does not exist.', 404);
  const stage = r.stages.find((s) => s.id === row.stage_id);
  if (!stage) return bad('That match has no stage.', 409);

  // A heat of a points series: { key, order: [entrant ids, first place first] }. Everyone in the heat must be listed once.
  if (b.action === 'report-heat') {
    if (stage.format !== 'points') return bad('That is not a points heat.');
    const heat = (row.heat ?? []) as HeatSlot[];
    const order = Array.isArray(b.order) ? b.order : [];
    if (order.length !== heat.length || new Set(order).size !== order.length || order.some((x) => !heat.some((h) => h.entrant_id === x)))
      return bad('List everyone in the heat once, in the order they finished.');
    const scored = scoreHeat(order, stage.settings.points_table);
    await r.svc.from('tournament_matches').update({ heat: scored, status: 'done', updated_at: now() }).eq('tournament_id', t.id).eq('key', row.key);
    const mine = r.matches.filter((m) => m.stage_id === stage.id).map((m) => (m.key === row.key ? { ...m, status: 'done' as const } : m));
    const players = r.stageEntrants.filter((x) => x.stage_id === stage.id).length;
    const st = await refreshStatus(r.svc, t, r.stages, stage, mine.map(toMatch), players);
    return NextResponse.json({ ok: true, complete: st.complete, stageDone: st.stageDone });
  }

  if (b.action === 'station' || b.action === 'live') {
    const patch: Record<string, unknown> = { updated_at: now() };
    if (b.action === 'station') patch.station = (b.station ?? '').toString().trim().slice(0, 30) || null;
    if (b.action === 'live') {
      if (row.status !== 'ready' && row.status !== 'live') return bad('That match is not ready yet.', 409);
      patch.status = b.on === false ? 'ready' : 'live';
    }
    await r.svc.from('tournament_matches').update(patch).eq('tournament_id', t.id).eq('key', row.key);
    return NextResponse.json({ ok: true });
  }

  // The producer's quick entry: one game at a time ("A won this game"). The series score shows on the overlays as it goes, and the match finishes by itself when someone reaches the winning number of games.
  if (b.action === 'game' || b.action === 'undo-game') {
    if (row.status !== 'ready' && row.status !== 'live') return bad('That match is not being played.', 409);
    const bestOf = bestOfOf(t, stage, row);
    const need = Math.ceil(bestOf / 2);
    const played: Game[] = [...(row.games ?? [])];
    if (b.action === 'undo-game') played.pop();
    else {
      if (b.winner !== 'a' && b.winner !== 'b' && !(Number.isFinite(b.scoreA) && Number.isFinite(b.scoreB))) return bad('Say who won the game.');
      const ga = b.winner ? (b.winner === 'a' ? 1 : 0) : Math.max(0, Math.trunc(Number(b.scoreA)));
      const gb = b.winner ? (b.winner === 'b' ? 1 : 0) : Math.max(0, Math.trunc(Number(b.scoreB)));
      if (ga === gb) return bad('A game needs a winner.');
      played.push({ a: ga, b: gb, map: b.map?.slice(0, 40) });
    }
    const sa = played.filter((g) => g.a > g.b).length;
    const sb = played.filter((g) => g.b > g.a).length;
    if (b.action === 'game' && (sa >= need || sb >= need)) {
      // That was the deciding game: finish the match the normal way.
      b.action = 'report';
      b.games = played;
    } else {
      await r.svc
        .from('tournament_matches')
        .update({ games: played, score_a: played.length ? sa : null, score_b: played.length ? sb : null, status: 'live', updated_at: now() })
        .eq('tournament_id', t.id)
        .eq('key', row.key);
      return NextResponse.json({ ok: true, a: sa, b: sb });
    }
  }

  try {
    const mine = stageEngineMatches(r.matches, stage);
    const ekey = engineKey(row.key);
    const bestOf = bestOfOf(t, stage, row);
    let next: Match[];
    let games: Game[] = row.games;
    if (b.action === 'undo') {
      next = undo(mine, ekey);
      games = [];
    } else {
      let sa = Number(b.scoreA);
      let sb = Number(b.scoreB);
      if (Array.isArray(b.games) && b.games.length > 0) {
        games = b.games.slice(0, bestOf).map((g) => ({
          a: Math.max(0, Math.trunc(Number(g.a) || 0)),
          b: Math.max(0, Math.trunc(Number(g.b) || 0)),
          map: g.map?.slice(0, 40),
          pick_a: g.pick_a?.slice(0, 40),
          pick_b: g.pick_b?.slice(0, 40),
        }));
        sa = games.filter((g) => g.a > g.b).length;
        sb = games.filter((g) => g.b > g.a).length;
      }
      const need = Math.ceil(bestOf / 2);
      if (bestOf > 1 && sa !== need && sb !== need) return bad(`A best of ${bestOf} ends when someone has won ${need} games.`);
      if (bestOf > 1 && Math.max(sa, sb) > need) return bad(`A best of ${bestOf} cannot go past ${need} wins.`);
      const robin = stage.format === 'roundrobin' || stage.format === 'swiss' || stage.format === 'custom';
      next = report(mine, ekey, sa, sb, { allowTie: robin && bestOf === 1 });
    }
    await saveMatches(
      r.svc,
      t.id,
      stage,
      r.matches.filter((m) => m.stage_id === stage.id),
      next,
    );
    await r.svc.from('tournament_matches').update({ games }).eq('tournament_id', t.id).eq('key', row.key);
    const players = r.stageEntrants.filter((x) => x.stage_id === stage.id).length;
    const st = await refreshStatus(r.svc, t, r.stages, stage, next, players);
    void toMatch;
    return NextResponse.json({ ok: true, complete: st.complete, stageDone: st.stageDone });
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Could not save that result.', 409);
  }
}
