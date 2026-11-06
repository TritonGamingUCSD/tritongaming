import { NextResponse } from 'next/server';
import { who, unauthorized, guardFeature } from '@/lib/tournaments/server';
import { canCreateTournamentFor, canManageTournament } from '@/lib/tournaments/access';
import { slugify } from '@/lib/tournaments/store';
import { TEMPLATES, type StageDef } from '@/lib/tournaments/stages';
import { logAudit } from '@/lib/notifications/audit';
import { refuseBlocked } from '@/lib/wordfilter/server';

export const dynamic = 'force-dynamic';

const FORMATS = ['single', 'double', 'roundrobin', 'swiss', 'points', 'custom'];

// The tournaments this person can see: every public one that has started signing up, plus the ones they organize (drafts too).
export async function GET(req: Request) {
  const off = await guardFeature('tournaments');
  if (off) return off;
  const me = await who();
  const svc = (await import('@/lib/supabase/admin')).createServiceClient();
  const division = new URL(req.url).searchParams.get('division');
  let q = svc
    .from('tournaments')
    .select('id, slug, name, game, format, entrant_type, best_of, status, is_public, signups_open, starts_at, division_id, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (division) q = q.eq('division_id', division);
  const { data } = await q;
  const { data: staffRows } = me ? await svc.from('tournament_staff').select('tournament_id').eq('user_id', me.user.id) : { data: [] };
  const staff = new Set((staffRows ?? []).map((r) => r.tournament_id as string));
  const rows = (data ?? [])
    .map((t) => ({ ...t, manage: !!me && canManageTournament(me.roles, t, staff.has(t.id)) }))
    .filter((t) => t.manage || (t.is_public && t.status !== 'draft'));
  return NextResponse.json({ tournaments: rows });
}

// Create one: { name, game?, division_id?, format, entrant_type?, team_size?, best_of?, third_place?, max_entrants?, starts_at? }. Starts as a draft.
export async function POST(request: Request) {
  const off = await guardFeature('tournaments');
  if (off) return off;
  const me = await who();
  if (!me) return unauthorized();
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(b.name ?? '')
    .trim()
    .slice(0, 80);
  if (name.length < 3) return NextResponse.json({ error: 'Give the tournament a name (at least 3 letters).' }, { status: 400 });
  const blocked = await refuseBlocked({ Name: name, Game: String(b.game ?? ''), Description: String(b.description ?? '') });
  if (blocked) return blocked;
  const divisionId = typeof b.division_id === 'string' && b.division_id ? b.division_id : null;
  if (divisionId) {
    const offDiv = await guardFeature('div_tournaments');
    if (offDiv) return offDiv;
  }
  if (!canCreateTournamentFor(me.roles, divisionId)) return NextResponse.json({ error: 'You cannot create tournaments for that owner.' }, { status: 403 });
  // The structure: a template (one click) or a list of stages. A plain `format` still works and makes one stage.
  const bestOf = [1, 3, 5, 7].includes(Number(b.best_of)) ? Number(b.best_of) : 1;
  let stages: { name: string; def: StageDef }[];
  if (Array.isArray(b.stages) && b.stages.length > 0) {
    stages = (b.stages as { name?: string; format?: string; settings?: object; advance?: object }[]).slice(0, 6).map((x, i) => ({
      name: String(x.name || `Stage ${i + 1}`).slice(0, 40),
      def: { format: x.format as StageDef['format'], settings: (x.settings ?? {}) as StageDef['settings'], advance: (x.advance ?? { mode: 'none' }) as StageDef['advance'] },
    }));
  } else {
    const tpl = TEMPLATES.find((x) => x.id === (b.template ?? b.format ?? 'single'));
    if (!tpl) return NextResponse.json({ error: 'Pick a format.' }, { status: 400 });
    stages = tpl.stages.map((x) => ({ name: x.name, def: { ...x.def, settings: { ...x.def.settings } } }));
  }
  if (stages.some((x) => !FORMATS.includes(x.def.format))) return NextResponse.json({ error: 'That format does not exist.' }, { status: 400 });
  if (b.third_place) for (const x of stages) if (x.def.format === 'single') x.def.settings.third_place = true;
  if (bestOf > 1) for (const x of stages) if (x.def.format !== 'points') x.def.settings.best_of = bestOf;
  const format = stages.length > 1 ? 'multi' : stages[0].def.format;
  const type = b.entrant_type === 'team' ? 'team' : 'solo';
  const teamSize = Math.min(10, Math.max(2, Number(b.team_size) || 2));
  const max = b.max_entrants ? Math.min(512, Math.max(2, Number(b.max_entrants))) : null;
  const startsAt = typeof b.starts_at === 'string' && b.starts_at ? new Date(b.starts_at) : null;
  // A readable address from the name; a number is added when it is taken.
  const base = slugify(name);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const { data: hit } = await me.svc.from('tournaments').select('id').eq('slug', slug).maybeSingle();
    if (!hit) break;
    slug = `${base}-${i}`;
  }
  const { data, error } = await me.svc
    .from('tournaments')
    .insert({
      slug,
      name,
      game: String(b.game ?? '')
        .trim()
        .slice(0, 60),
      description: String(b.description ?? '')
        .trim()
        .slice(0, 2000),
      division_id: divisionId,
      format,
      entrant_type: type,
      team_size: teamSize,
      best_of: bestOf,
      third_place: !!b.third_place && stages.some((x) => x.def.format === 'single'),
      max_entrants: max,
      starts_at: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt.toISOString() : null,
      created_by: me.user.id,
    })
    .select('id, slug')
    .single();
  if (error || !data) return NextResponse.json({ error: 'Could not create it. Try again.' }, { status: 500 });
  const { error: stageError } = await me.svc
    .from('tournament_stages')
    .insert(stages.map((x, i) => ({ tournament_id: data.id, position: i + 1, name: x.name, format: x.def.format, settings: x.def.settings, advance: x.def.advance })));
  if (stageError) {
    await me.svc.from('tournaments').delete().eq('id', data.id);
    return NextResponse.json({ error: 'Could not create it. Try again.' }, { status: 500 });
  }
  await logAudit(me.svc, { actorId: me.user.id, action: 'create', entityType: 'tournament', entityId: data.id, summary: `Created tournament “${name}”` });
  return NextResponse.json({ ok: true, id: data.id, slug: data.slug });
}
