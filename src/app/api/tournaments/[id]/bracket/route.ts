import { NextResponse } from 'next/server';
import { withTournament } from '@/lib/tournaments/server';
import { report, undo, swissRound, swissRounds, seat, seats, type Match } from '@/lib/tournaments/bracket';
import { engineKey, saveMatches, toMatch, toRow } from '@/lib/tournaments/store';
import { bestOfOf, currentStage, hasStarted, heatRowsFor, refreshStatus, stageEngineMatches, stageField, startStage } from '@/lib/tournaments/run';
import { dealHeats, pointsStandings, scoreHeat, type HeatSlot } from '@/lib/tournaments/points';
import { scheduleMatches } from '@/lib/tournaments/schedule';
import { logAudit } from '@/lib/notifications/audit';
import { refuseBlocked } from '@/lib/wordfilter/server';

export const dynamic = 'force-dynamic';

type Game = { a: number; b: number; map?: string; pick_a?: string; pick_b?: string };
type Body = {
  action?:
    | 'start'
    | 'start-stage'
    | 'report'
    | 'undo'
    | 'next-round'
    | 'station'
    | 'live'
    | 'reset'
    | 'game'
    | 'undo-game'
    | 'report-heat'
    | 'add-match'
    | 'add-matches'
    | 'edit-match'
    | 'delete-match'
    | 'schedule'
    | 'clear-schedule'
    | 'place'
    | 'fill-slots'
    | 'clear-slots';
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
  pairs?: [string, string][];
  label?: string | null;
  scheduled_at?: string | null;
  best_of?: number | null;
  start?: string;
  minutes?: number;
  parallel?: number;
  gap?: number;
  overwrite?: boolean;
  side?: 'a' | 'b';
  entrant_id?: string | null;
  mode?: 'random' | 'order';
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
    if (hasStarted(t)) return bad('It has already started.', 409);
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

  // Hand-made matches, times and match details can be worked on before the tournament starts (planning), so these come before the "has it started" check.
  // A custom stage: add matches by hand, { stage_id, a, b, label?, scheduled_at? } for one or { stage_id, pairs: [[a, b], …] } for several (every pairing at once, say). Before the tournament starts they are planned (they wait, and become ready when it starts); after, they are ready at once.
  if (b.action === 'add-match' || b.action === 'add-matches') {
    const stage = r.stages.find((s) => s.id === b.stage_id);
    if (!stage || stage.format !== 'custom') return bad('Matches are added by hand only in a custom stage.');
    if (stage.status === 'pending' && stage.position !== 1) return bad('A later stage gets its entrants when the stage before it is finished.', 409);
    const ids = new Set(r.entrants.filter((e) => !e.dropped).map((e) => e.id));
    const pairs: [string, string][] = b.action === 'add-matches' ? (Array.isArray(b.pairs) ? b.pairs : []).slice(0, 200) : [[String(b.a ?? ''), String(b.b ?? '')]];
    if (pairs.length === 0) return bad('Pick the matches to add.');
    if (pairs.some(([x, y]) => !x || !y || x === y || !ids.has(x) || !ids.has(y))) return bad('Pick two different entrants for each match.');
    const label = typeof b.label === 'string' ? b.label.trim().slice(0, 40) : '';
    const blockedLabel = await refuseBlocked({ Name: label });
    if (blockedLabel) return blockedLabel;
    const when = b.scheduled_at && !Number.isNaN(Date.parse(b.scheduled_at)) ? new Date(b.scheduled_at).toISOString() : null;
    const planned = stage.status === 'pending';
    let n = Math.max(0, ...r.matches.filter((m) => m.stage_id === stage.id).map((m) => m.idx));
    const rows = pairs.map(([x, y]) => {
      n += 1;
      return {
        tournament_id: t.id,
        stage_id: stage.id,
        group_no: null,
        key: `s${stage.position}/C${n}`,
        bracket: 'RR',
        round: 1,
        idx: n,
        a: x,
        b: y,
        score_a: null,
        score_b: null,
        winner: null,
        status: planned ? 'pending' : 'ready',
        win_to: null,
        lose_to: null,
        label: label || null,
        scheduled_at: when,
      };
    });
    const { error } = await r.svc.from('tournament_matches').insert(rows);
    if (error) return bad('Could not add the match.', 500);
    if (!planned) {
      // the stage and the tournament are playing now (they may have finished before this match was added)
      await r.svc.from('tournament_stages').update({ status: 'live' }).eq('id', stage.id);
      if (t.status === 'complete') await r.svc.from('tournaments').update({ status: 'live', updated_at: now() }).eq('id', t.id);
    }
    return NextResponse.json({ ok: true, added: rows.length, key: rows[0].key });
  }

  // Change a match's details, { key, label?, scheduled_at?, best_of? } for any match that is not finished, and { a, b } to change who plays in a custom stage while nothing is scored.
  if (b.action === 'edit-match') {
    const row = r.matches.find((m) => m.key === b.key);
    if (!row) return bad('That match does not exist.', 404);
    const stage = r.stages.find((s) => s.id === row.stage_id);
    if (row.status === 'done') return bad('A finished match cannot be edited. Undo its result first.', 409);
    const patch: Record<string, unknown> = { updated_at: now() };
    if ('label' in b) {
      const label = typeof b.label === 'string' ? b.label.trim().slice(0, 40) : '';
      const blockedLabel = await refuseBlocked({ Name: label });
      if (blockedLabel) return blockedLabel;
      patch.label = label || null;
    }
    if ('scheduled_at' in b) {
      if (b.scheduled_at && Number.isNaN(Date.parse(b.scheduled_at))) return bad('That is not a time.');
      patch.scheduled_at = b.scheduled_at ? new Date(b.scheduled_at).toISOString() : null;
    }
    if ('best_of' in b) {
      if (b.best_of !== null && ![1, 3, 5, 7].includes(Number(b.best_of))) return bad('Best of 1, 3, 5 or 7 (or empty for the stage’s setting).');
      if ((row.games ?? []).length > 0) return bad('Games are already recorded, so the length cannot change.', 409);
      patch.best_of = b.best_of === null ? null : Number(b.best_of);
    }
    if ('a' in b || 'b' in b) {
      if (!stage || stage.format !== 'custom') return bad('Only matches in a custom stage can change players.');
      if (row.score_a !== null || row.score_b !== null || (row.games ?? []).length > 0) return bad('Scores are already entered. Undo them first.', 409);
      const ids = new Set(r.entrants.filter((e) => !e.dropped).map((e) => e.id));
      const na = 'a' in b ? String(b.a ?? '') : (row.a ?? '');
      const nb = 'b' in b ? String(b.b ?? '') : (row.b ?? '');
      if (!na || !nb || na === nb || !ids.has(na) || !ids.has(nb)) return bad('Pick two different entrants.');
      patch.a = na;
      patch.b = nb;
    }
    const { error } = await r.svc.from('tournament_matches').update(patch).eq('tournament_id', t.id).eq('key', row.key);
    if (error) return bad('Could not save that.', 500);
    return NextResponse.json({ ok: true });
  }

  // Fill in start times for a stage, { stage_id, start, minutes, parallel, gap?, overwrite? }: round by round, `parallel` matches at a time. Matches that already have a time keep it unless `overwrite`. { action: 'clear-schedule', stage_id } takes them all off.
  if (b.action === 'schedule' || b.action === 'clear-schedule') {
    const stage = r.stages.find((s) => s.id === b.stage_id);
    if (!stage) return bad('Pick a stage.');
    const rows = r.matches.filter((m) => m.stage_id === stage.id);
    if (b.action === 'clear-schedule') {
      await r.svc.from('tournament_matches').update({ scheduled_at: null }).eq('stage_id', stage.id).neq('status', 'done');
      return NextResponse.json({ ok: true });
    }
    if (!b.start || Number.isNaN(Date.parse(b.start))) return bad('Pick the first start time.');
    const times = scheduleMatches(rows, { start: b.start, minutes: Number(b.minutes) || 30, parallel: Number(b.parallel) || 1, gap: Number(b.gap) || 0 });
    let n = 0;
    for (const m of rows) {
      const at = times.get(m.key);
      if (!at || (m.scheduled_at && !b.overwrite)) continue;
      await r.svc.from('tournament_matches').update({ scheduled_at: at, updated_at: now() }).eq('tournament_id', t.id).eq('key', m.key);
      n += 1;
    }
    return NextResponse.json({ ok: true, scheduled: n });
  }

  // Take a hand-made match out, { key }, while nothing is scored on it.
  if (b.action === 'delete-match') {
    const row = r.matches.find((m) => m.key === b.key);
    if (!row) return bad('That match does not exist.', 404);
    const stage = r.stages.find((s) => s.id === row.stage_id);
    if (!stage || stage.format !== 'custom') return bad('Only matches made by hand can be removed.');
    if (row.status === 'done' || row.score_a !== null || row.score_b !== null || (row.games ?? []).length > 0) return bad('It has a result. Undo it first.', 409);
    await r.svc.from('tournament_matches').delete().eq('tournament_id', t.id).eq('key', row.key);
    return NextResponse.json({ ok: true });
  }

  if (t.status !== 'live' && t.status !== 'complete') return bad('The tournament has not started.', 409);

  // A bracket that starts with empty places (placement "by hand or draw"): put a team in a place, { key, side, entrant_id | null }, draw everyone left into the empty places, { stage_id, mode: 'random' | 'order' },
  // or empty them all, { stage_id }. Allowed until the first result is in; the bracket is rebuilt from the places each time, so nothing has to be unwound.
  if (b.action === 'place' || b.action === 'fill-slots' || b.action === 'clear-slots') {
    const stageId = b.action === 'place' ? r.matches.find((m) => m.key === b.key)?.stage_id : b.stage_id;
    const stage = r.stages.find((s) => s.id === stageId);
    if (!stage || (stage.format !== 'single' && stage.format !== 'double') || stage.settings?.placement !== 'manual') return bad('That bracket is placed by seed, not by hand.');
    const rows = r.matches.filter((m) => m.stage_id === stage.id);
    if (rows.some((m) => m.status === 'done' || m.status === 'live' || m.score_a !== null || (m.games ?? []).length > 0))
      return bad('A result is already in, so the places are locked.', 409);
    const mine = stageEngineMatches(r.matches, stage);
    const places = seats(mine);
    if (places.length === 0) return bad('This bracket has no places yet.', 409);
    const inStage = new Set(r.stageEntrants.filter((x) => x.stage_id === stage.id).map((x) => x.entrant_id));
    const alive = r.entrants.filter((e) => !e.dropped && inStage.has(e.id));
    const at = (p: { key: string; side: string }) => `${p.key}:${p.side}`;
    let placed: Record<string, string | null> = {};
    for (const p of places) if (p.slot) placed[at(p)] = p.slot;
    if (b.action === 'clear-slots') placed = {};
    else if (b.action === 'place') {
      const ek = engineKey(String(b.key));
      const target = places.find((p) => p.key === ek && p.side === b.side);
      if (!target) return bad('That is not a place a team can sit.');
      if (b.entrant_id) {
        if (!alive.some((e) => e.id === b.entrant_id)) return bad('Pick someone who is in this stage.');
        for (const k of Object.keys(placed)) if (placed[k] === b.entrant_id) delete placed[k]; // moving them: the old place empties
        placed[at(target)] = b.entrant_id;
      } else delete placed[at(target)];
    } else {
      const seated = new Set(Object.values(placed));
      const left = alive.filter((e) => !seated.has(e.id)).sort((x, y) => (x.seed ?? 1e9) - (y.seed ?? 1e9));
      if (b.mode === 'random')
        for (let i = left.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [left[i], left[j]] = [left[j], left[i]];
        }
      const empty = places.filter((p) => !placed[at(p)]);
      empty.slice(0, left.length).forEach((p, i) => (placed[at(p)] = left[i].id));
    }
    try {
      const next = seat(stage.format, places.length, { thirdPlace: !!stage.settings.third_place, grandFinalReset: stage.settings.grand_final_reset !== false }, placed);
      await saveMatches(r.svc, t.id, stage, rows, next);
    } catch (e) {
      return bad(e instanceof Error ? e.message : 'Could not place that.', 409);
    }
    return NextResponse.json({ ok: true });
  }

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
