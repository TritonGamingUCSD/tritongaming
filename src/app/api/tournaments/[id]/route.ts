import { NextResponse } from 'next/server';
import { withTournament } from '@/lib/tournaments/server';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

// The whole tournament for the organizer screen (everything), or the public view (no tokens, user ids or claim codes).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await withTournament(id, 'view');
  if ('error' in r) return r.error;
  const { tournament: t, entrants, matches, staff, stages, stageEntrants, manage, run } = r;
  const publicT = { ...t, overlay_token: manage ? t.overlay_token : undefined, created_by: undefined };
  return NextResponse.json({
    tournament: publicT,
    entrants: entrants.map((e) => ({
      id: e.id,
      name: e.name,
      seed: e.seed,
      checked_in: e.checked_in,
      dropped: e.dropped,
      members: e.members.map((m) => ({ name: m.name })),
      ...(manage ? { user_id: e.user_id, claim_code: e.claim_code } : { linked: !!e.user_id }),
    })),
    matches,
    stages,
    stageEntrants,
    staff: manage ? staff : undefined,
    can: { manage, run },
  });
}

const EDITABLE = ['name', 'game', 'description', 'best_of', 'third_place', 'max_entrants', 'is_public', 'signups_open', 'starts_at', 'swiss_rounds', 'team_size'] as const;

// Change settings: { …fields, status? }. Format and entrant type are locked once the bracket exists. Moving to 'registration' opens sign-ups to those who may.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await withTournament(id, 'manage');
  if ('error' in r) return r.error;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in b) patch[k] = b[k];
  if ('best_of' in patch && ![1, 3, 5, 7].includes(Number(patch.best_of))) return NextResponse.json({ error: 'Best of 1, 3, 5 or 7.' }, { status: 400 });
  if (typeof patch.name === 'string') patch.name = patch.name.trim().slice(0, 80);
  if (typeof patch.name === 'string' && (patch.name as string).length < 3) return NextResponse.json({ error: 'Give the tournament a name (at least 3 letters).' }, { status: 400 });
  if (r.matches.length > 0 && ('best_of' in patch || 'third_place' in patch || 'team_size' in patch))
    return NextResponse.json({ error: 'Those cannot change once the bracket has started.' }, { status: 409 });
  const status = typeof b.status === 'string' ? b.status : null;
  if (status) {
    if (!['draft', 'registration'].includes(status)) return NextResponse.json({ error: 'Use Start to begin the bracket.' }, { status: 400 });
    if (r.matches.length > 0) return NextResponse.json({ error: 'The bracket has started.' }, { status: 409 });
    patch.status = status;
    patch.signups_open = status === 'registration';
  }
  if (b.new_overlay_token === true) patch.overlay_token = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('');
  patch.updated_at = new Date().toISOString();
  const { error } = await r.svc.from('tournaments').update(patch).eq('id', r.tournament.id);
  if (error) return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 });
  await logAudit(r.svc, { actorId: r.me!.user.id, action: 'update', entityType: 'tournament', entityId: r.tournament.id, summary: `Changed tournament “${r.tournament.name}”` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await withTournament(id, 'manage');
  if ('error' in r) return r.error;
  if (r.tournament.status === 'live' && r.matches.some((m) => m.status === 'done') && !r.me!.roles.some((x) => x.role === 'admin' || x.role === 'exec'))
    return NextResponse.json({ error: 'A tournament in play can only be deleted by exec or admin.' }, { status: 409 });
  await r.svc.from('tournaments').delete().eq('id', r.tournament.id);
  await logAudit(r.svc, { actorId: r.me!.user.id, action: 'delete', entityType: 'tournament', entityId: r.tournament.id, summary: `Deleted tournament “${r.tournament.name}”` });
  return NextResponse.json({ ok: true });
}
