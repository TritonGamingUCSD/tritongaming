import { NextResponse } from 'next/server';
import { withTournament } from '@/lib/tournaments/server';
import type { StageDef } from '@/lib/tournaments/stages';
import { cleanRoundNames } from '@/lib/tournaments/schedule';
import { refuseBlocked } from '@/lib/wordfilter/server';

export const dynamic = 'force-dynamic';

const FORMATS = ['single', 'double', 'roundrobin', 'swiss', 'points', 'custom'];

function clean(b: { name?: unknown; format?: unknown; settings?: Record<string, unknown>; advance?: Record<string, unknown> }) {
  const out: Record<string, unknown> = {};
  if (typeof b.name === 'string') out.name = b.name.trim().slice(0, 40) || 'Stage';
  if (typeof b.format === 'string' && FORMATS.includes(b.format)) out.format = b.format;
  if (b.settings && typeof b.settings === 'object') {
    const s = b.settings as StageDef['settings'];
    const ok: Record<string, unknown> = {};
    if (s.best_of !== undefined && [1, 3, 5, 7].includes(Number(s.best_of))) ok.best_of = Number(s.best_of);
    if (s.placement === 'seed' || s.placement === 'manual') ok.placement = s.placement;
    if (s.slots !== undefined && s.slots !== null) ok.slots = Math.min(128, Math.max(2, Math.trunc(Number(s.slots) || 2)));
    if (typeof s.third_place === 'boolean') ok.third_place = s.third_place;
    if (typeof s.grand_final_reset === 'boolean') ok.grand_final_reset = s.grand_final_reset;
    if (s.swiss_rounds !== undefined && s.swiss_rounds !== null) ok.swiss_rounds = Math.min(20, Math.max(1, Math.trunc(Number(s.swiss_rounds) || 1)));
    if (s.group_count !== undefined) ok.group_count = Math.min(32, Math.max(1, Math.trunc(Number(s.group_count) || 1)));
    if (s.seeding === 'seed' || s.seeding === 'random') ok.seeding = s.seeding;
    if (Array.isArray(s.tiebreakers)) ok.tiebreakers = s.tiebreakers.filter((x) => ['wins', 'diff', 'h2h', 'buchholz', 'seed'].includes(x));
    if (s.scoring && typeof s.scoring === 'object') ok.scoring = { win: Number(s.scoring.win) || 0, draw: Number(s.scoring.draw) || 0, loss: Number(s.scoring.loss) || 0 };
    if (Array.isArray(s.points_table)) ok.points_table = s.points_table.slice(0, 32).map((x) => Math.max(0, Number(x) || 0));
    if (s.heat_size !== undefined) ok.heat_size = Math.min(16, Math.max(2, Math.trunc(Number(s.heat_size) || 4)));
    if (s.rounds !== undefined) ok.rounds = Math.min(30, Math.max(1, Math.trunc(Number(s.rounds) || 1)));
    out.settings = ok;
  }
  if (b.advance && typeof b.advance === 'object') {
    const a = b.advance as { mode?: string; count?: number; per_group?: boolean };
    const mode = ['none', 'all', 'top'].includes(a.mode ?? '') ? a.mode : 'none';
    out.advance = { mode, ...(mode === 'top' ? { count: Math.min(256, Math.max(1, Math.trunc(Number(a.count) || 1))), per_group: !!a.per_group } : {}) };
  }
  return out;
}

// Edit the structure while it is still open to change: add a stage, change one (name, format, settings, who moves on), put them in a new order, or take one away. A stage that has started is locked; a later stage that has not started can still change.
// POST { name?, format, settings?, advance? } adds. PATCH { id, ... } changes, or { order: [stage ids] } reorders, or { id, groups: [[entrant ids], ...] } sets the pools by hand. DELETE { id } removes.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await withTournament(id, 'manage');
  if ('error' in r) return r.error;
  const b = (await request.json().catch(() => ({}))) as Parameters<typeof clean>[0];
  if (r.stages.length >= 6) return NextResponse.json({ error: 'That is plenty of stages (6 at most).' }, { status: 400 });
  const blocked = await refuseBlocked({ Stage: String(b.name ?? '') });
  if (blocked) return blocked;
  const c = clean(b);
  if (!c.format) return NextResponse.json({ error: 'Pick a format for the stage.' }, { status: 400 });
  const position = r.stages.length + 1;
  const { data, error } = await r.svc
    .from('tournament_stages')
    .insert({ tournament_id: r.tournament.id, position, name: c.name ?? `Stage ${position}`, format: c.format, settings: c.settings ?? {}, advance: c.advance ?? { mode: 'none' } })
    .select('id')
    .single();
  if (error || !data) return NextResponse.json({ error: 'Could not add it.' }, { status: 500 });
  // The stage before it now has somewhere to send people: if it sent nobody on, it sends the top 4.
  const prev = r.stages[r.stages.length - 1];
  if (prev && prev.status === 'pending' && (prev.advance?.mode ?? 'none') === 'none')
    await r.svc
      .from('tournament_stages')
      .update({ advance: { mode: 'top', count: 4, per_group: false } })
      .eq('id', prev.id);
  await r.svc.from('tournaments').update({ format: 'multi', updated_at: new Date().toISOString() }).eq('id', r.tournament.id);
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await withTournament(id, 'manage');
  if ('error' in r) return r.error;
  const b = (await request.json().catch(() => ({}))) as Parameters<typeof clean>[0] & { id?: string; order?: string[]; groups?: string[][] };
  if (b.order) {
    if (r.stages.some((s) => s.status !== 'pending')) return NextResponse.json({ error: 'Stages cannot be reordered once one has started.' }, { status: 409 });
    const known = new Set(r.stages.map((s) => s.id));
    if (b.order.length !== known.size || b.order.some((x) => !known.has(x))) return NextResponse.json({ error: 'The order must list every stage once.' }, { status: 400 });
    // positions are unique, so move them out of the way first
    await Promise.all(
      b.order.map((sid, i) =>
        r.svc
          .from('tournament_stages')
          .update({ position: 100 + i })
          .eq('id', sid),
      ),
    );
    await Promise.all(
      b.order.map((sid, i) =>
        r.svc
          .from('tournament_stages')
          .update({ position: i + 1 })
          .eq('id', sid),
      ),
    );
    return NextResponse.json({ ok: true });
  }
  const stage = r.stages.find((s) => s.id === b.id);
  if (!stage) return NextResponse.json({ error: 'No such stage.' }, { status: 404 });
  // round names are only words: they can change any time, even while it is live
  if ('round_names' in b) {
    const names = cleanRoundNames((b as { round_names?: unknown }).round_names);
    const blockedNames = await refuseBlocked(Object.fromEntries(Object.entries(names).map(([k, v]) => [`Round ${k}`, v])));
    if (blockedNames) return blockedNames;
    await r.svc
      .from('tournament_stages')
      .update({ settings: { ...(stage.settings ?? {}), round_names: names } })
      .eq('id', stage.id);
    return NextResponse.json({ ok: true });
  }
  if (stage.status !== 'pending') return NextResponse.json({ error: 'That stage has started, so it is locked.' }, { status: 409 });
  if (b.groups) {
    // Pools by hand (drag an entrant into a pool): stored as the stage's entrants with a pool number.
    const flat = b.groups.flat();
    if (new Set(flat).size !== flat.length) return NextResponse.json({ error: 'Someone is in two pools.' }, { status: 400 });
    const valid = new Set(r.entrants.map((e) => e.id));
    if (flat.some((x) => !valid.has(x))) return NextResponse.json({ error: 'Someone is not in the tournament.' }, { status: 400 });
    await r.svc.from('tournament_stage_entrants').delete().eq('stage_id', stage.id);
    let seed = 0;
    const rows = b.groups.flatMap((g, gi) => g.map((eid) => ({ stage_id: stage.id, entrant_id: eid, seed: ++seed, group_no: gi + 1 })));
    if (rows.length) await r.svc.from('tournament_stage_entrants').insert(rows);
    return NextResponse.json({ ok: true });
  }
  const c = clean(b);
  if (c.format && c.format !== stage.format && r.matches.some((m) => m.stage_id === stage.id))
    return NextResponse.json({ error: 'That stage already has matches.' }, { status: 409 });
  if (c.settings) c.settings = { ...(stage.settings ?? {}), ...(c.settings as object) };
  const { error } = await r.svc.from('tournament_stages').update(c).eq('id', stage.id);
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await withTournament(id, 'manage');
  if ('error' in r) return r.error;
  const b = (await request.json().catch(() => ({}))) as { id?: string };
  const stage = r.stages.find((s) => s.id === b.id);
  if (!stage) return NextResponse.json({ error: 'No such stage.' }, { status: 404 });
  if (stage.status !== 'pending') return NextResponse.json({ error: 'That stage has started, so it cannot be removed.' }, { status: 409 });
  if (r.stages.length === 1) return NextResponse.json({ error: 'A tournament needs at least one stage.' }, { status: 409 });
  await r.svc.from('tournament_stages').delete().eq('id', stage.id);
  const rest = r.stages.filter((s) => s.id !== stage.id);
  await Promise.all(
    rest.map((s, i) =>
      r.svc
        .from('tournament_stages')
        .update({ position: 200 + i })
        .eq('id', s.id),
    ),
  );
  await Promise.all(
    rest.map((s, i) =>
      r.svc
        .from('tournament_stages')
        .update({ position: i + 1 })
        .eq('id', s.id),
    ),
  );
  await r.svc
    .from('tournaments')
    .update({ format: rest.length > 1 ? 'multi' : rest[0].format, updated_at: new Date().toISOString() })
    .eq('id', r.tournament.id);
  return NextResponse.json({ ok: true });
}
