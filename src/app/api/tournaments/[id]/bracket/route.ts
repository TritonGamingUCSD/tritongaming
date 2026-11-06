import { NextResponse } from 'next/server';
import { withTournament } from '@/lib/tournaments/server';
import { report, undo, swissRound, swissRounds, type Match } from '@/lib/tournaments/bracket';
import { engineKey, saveMatches, toMatch, toRow } from '@/lib/tournaments/store';
import { bestOfOf, currentStage, defOf, refreshStatus, stageEngineMatches, stageField, startStage } from '@/lib/tournaments/run';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

type Game = { a: number; b: number; map?: string; pick_a?: string; pick_b?: string };
type Body = {
  action?: 'start' | 'start-stage' | 'report' | 'undo' | 'next-round' | 'station' | 'live' | 'reset';
  key?: string;
  stage_id?: string;
  order?: string[];
  scoreA?: number;
  scoreB?: number;
  games?: Game[];
  station?: string;
  on?: boolean;
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
    if (first.format === 'points') return bad('Points series are dealt heat by heat; that screen is coming.');
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
    if (!stage || stage.format !== 'swiss') return bad('Only a Swiss stage has rounds to deal.');
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

  const row = r.matches.find((m) => m.key === b.key);
  if (!row) return bad('That match does not exist.', 404);
  const stage = r.stages.find((s) => s.id === row.stage_id);
  if (!stage) return bad('That match has no stage.', 409);

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
      if (Math.max(sa, sb) > need) return bad(`A best of ${bestOf} cannot go past ${need} wins.`);
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
