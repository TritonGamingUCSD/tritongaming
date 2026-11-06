import { NextResponse } from 'next/server';
import { withTournament } from '@/lib/tournaments/server';
import { startggEventSlug, normalizeUrl } from '@/lib/tournaments/external';
import { fetchStartggEvent } from '@/lib/tournaments/startgg';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

const code = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (x) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');

// Bring entrants in from a start.gg event: { url } (the event page link). They are added as guests in seed order (each with a claim code); the start.gg link is kept on the tournament. Only before the bracket starts.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await withTournament(id, 'manage');
  if ('error' in r) return r.error;
  if (r.matches.length > 0) return NextResponse.json({ error: 'The bracket has started. Entrants are locked.' }, { status: 409 });
  const b = (await request.json().catch(() => ({}))) as { url?: string };
  const slug = startggEventSlug(b.url ?? '');
  if (!slug) return NextResponse.json({ error: 'Paste a start.gg event link (it looks like start.gg/tournament/…/event/…).' }, { status: 400 });
  let ev;
  try {
    ev = await fetchStartggEvent(slug);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not read start.gg.' }, { status: 502 });
  }
  if (ev.entrants.length === 0) return NextResponse.json({ error: 'That event has no entrants yet.' }, { status: 404 });
  const room = r.tournament.max_entrants ? Math.max(0, r.tournament.max_entrants - r.entrants.length) : ev.entrants.length;
  const have = new Set(r.entrants.map((e) => e.name.toLowerCase()));
  const fresh = ev.entrants.filter((e) => !have.has(e.name.toLowerCase())).slice(0, room);
  if (fresh.length > 0) {
    const { error } = await r.svc.from('tournament_entrants').insert(fresh.map((e) => ({ tournament_id: r.tournament.id, name: e.name, claim_code: code() })));
    if (error) return NextResponse.json({ error: 'Could not add them.' }, { status: 500 });
  }
  // keep the link (and fill the game if it was empty)
  const link = normalizeUrl(b.url ?? '')!;
  const external = [...((r.tournament.settings?.external as { url: string }[] | undefined) ?? [])];
  if (!external.some((x) => x.url === link)) external.push({ provider: 'startgg', url: link, label: ev.name } as never);
  await r.svc
    .from('tournaments')
    .update({ settings: { ...(r.tournament.settings ?? {}), external }, ...(r.tournament.game ? {} : { game: ev.game.slice(0, 60) }), updated_at: new Date().toISOString() })
    .eq('id', r.tournament.id);
  await logAudit(r.svc, {
    actorId: r.me!.user.id,
    action: 'update',
    entityType: 'tournament',
    entityId: r.tournament.id,
    summary: `Imported ${fresh.length} entrants from start.gg into “${r.tournament.name}”`,
  });
  return NextResponse.json({ ok: true, added: fresh.length, skipped: ev.entrants.length - fresh.length, name: ev.name });
}
