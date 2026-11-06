import { NextResponse } from 'next/server';
import { withTournament } from '@/lib/tournaments/server';
import { generate, report, undo, swissRound, swissRounds, type Match } from '@/lib/tournaments/bracket';
import { saveMatches, toMatch, toRow } from '@/lib/tournaments/store';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

type Game = { a: number; b: number; map?: string; pick_a?: string; pick_b?: string };
type Body = {
  action?: 'start' | 'report' | 'undo' | 'next-round' | 'station' | 'live' | 'reset';
  key?: string;
  scoreA?: number;
  scoreB?: number;
  games?: Game[];
  station?: string;
  on?: boolean;
};

// Everything that moves a bracket: start it, enter or undo a result, deal the next Swiss round, call a match to a station, mark it live, or reset it back to registration.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as Body;
  const manageOnly = b.action === 'start' || b.action === 'reset';
  const r = await withTournament(id, manageOnly ? 'manage' : 'run');
  if ('error' in r) return r.error;
  const t = r.tournament;
  const bad = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });
  const engine: Match[] = r.matches.map(toMatch);
  const now = () => new Date().toISOString();

  if (b.action === 'start') {
    if (r.matches.length > 0) return bad('It has already started.', 409);
    if (t.format === 'points') return bad('Points tournaments are not ready yet.');
    const active = r.entrants.filter((e) => !e.dropped);
    if (active.length < 2) return bad('Add at least two entrants first.');
    // Seeds: those set by hand first, the rest after them in the order they joined.
    const ordered = [...active].sort((x, y) => (x.seed ?? 1e9) - (y.seed ?? 1e9));
    const entrants = ordered.map((e, i) => ({ id: e.id, seed: i + 1 }));
    await Promise.all(entrants.map((e) => r.svc.from('tournament_entrants').update({ seed: e.seed }).eq('id', e.id)));
    const made = generate(t.format as 'single' | 'double' | 'roundrobin' | 'swiss', entrants, { thirdPlace: t.third_place });
    const { error } = await r.svc.from('tournament_matches').insert(made.map((m) => toRow(t.id, m)));
    if (error) return bad('Could not build the bracket.', 500);
    await r.svc.from('tournaments').update({ status: 'live', signups_open: false, updated_at: now() }).eq('id', t.id);
    await logAudit(r.svc, {
      actorId: r.me!.user.id,
      action: 'update',
      entityType: 'tournament',
      entityId: t.id,
      summary: `Started tournament “${t.name}” with ${active.length} entrants`,
    });
    return NextResponse.json({ ok: true, matches: made.length });
  }

  if (b.action === 'reset') {
    await r.svc.from('tournament_matches').delete().eq('tournament_id', t.id);
    await r.svc.from('tournaments').update({ status: 'registration', signups_open: false, updated_at: now() }).eq('id', t.id);
    await logAudit(r.svc, { actorId: r.me!.user.id, action: 'update', entityType: 'tournament', entityId: t.id, summary: `Reset tournament “${t.name}” back to registration` });
    return NextResponse.json({ ok: true });
  }

  if (t.status !== 'live' && t.status !== 'complete') return bad('The tournament has not started.', 409);

  if (b.action === 'next-round') {
    if (t.format !== 'swiss') return bad('Only Swiss tournaments have rounds to deal.');
    const ids = r.entrants.filter((e) => !e.dropped).map((e) => e.id);
    const total = t.swiss_rounds ?? swissRounds(ids.length);
    const played = Math.max(0, ...engine.map((m) => m.round));
    if (engine.some((m) => m.status === 'ready' || m.status === 'pending')) return bad('Finish this round first.', 409);
    if (played >= total) return bad('That was the last round.', 409);
    const made = swissRound(ids, engine, played + 1);
    for (const m of made) {
      // The odd player's bye counts as a win at once; every other pairing is ready to play.
      if (m.b === 'BYE') {
        m.status = 'bye';
        m.winner = 'a';
      } else m.status = 'ready';
    }
    await r.svc.from('tournament_matches').insert(made.map((m) => toRow(t.id, m)));
    if (t.status === 'complete') await r.svc.from('tournaments').update({ status: 'live', updated_at: now() }).eq('id', t.id);
    return NextResponse.json({ ok: true, round: played + 1 });
  }

  const row = r.matches.find((m) => m.key === b.key);
  if (!row) return bad('That match does not exist.', 404);

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
    let next: Match[];
    let games: Game[] = row.games;
    if (b.action === 'undo') {
      next = undo(engine, row.key);
      games = [];
    } else {
      let sa = Number(b.scoreA);
      let sb = Number(b.scoreB);
      if (Array.isArray(b.games) && b.games.length > 0) {
        games = b.games.slice(0, t.best_of).map((g) => ({
          a: Math.max(0, Math.trunc(Number(g.a) || 0)),
          b: Math.max(0, Math.trunc(Number(g.b) || 0)),
          map: g.map?.slice(0, 40),
          pick_a: g.pick_a?.slice(0, 40),
          pick_b: g.pick_b?.slice(0, 40),
        }));
        sa = games.filter((g) => g.a > g.b).length;
        sb = games.filter((g) => g.b > g.a).length;
      }
      const need = Math.ceil(t.best_of / 2);
      if (t.best_of > 1 && sa !== need && sb !== need) return bad(`A best of ${t.best_of} ends when someone has won ${need} games.`);
      if (Math.max(sa, sb) > need) return bad(`A best of ${t.best_of} cannot go past ${need} wins.`);
      const robin = t.format === 'roundrobin' || t.format === 'swiss';
      next = report(engine, row.key, sa, sb, { allowTie: robin && t.best_of === 1 });
    }
    await saveMatches(r.svc, t.id, r.matches, next);
    await r.svc.from('tournament_matches').update({ games }).eq('tournament_id', t.id).eq('key', row.key);
    // Finished when nothing is left to play (a Swiss tournament also needs its last round dealt).
    let done = !next.some((m) => m.status === 'ready' || m.status === 'pending');
    if (done && t.format === 'swiss') done = Math.max(...next.map((m) => m.round)) >= (t.swiss_rounds ?? swissRounds(r.entrants.filter((e) => !e.dropped).length));
    if (done !== (t.status === 'complete'))
      await r.svc
        .from('tournaments')
        .update({ status: done ? 'complete' : 'live', updated_at: now() })
        .eq('id', t.id);
    return NextResponse.json({ ok: true, complete: done });
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Could not save that result.', 409);
  }
}
