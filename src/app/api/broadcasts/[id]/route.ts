import { NextResponse } from 'next/server';
import { broadcasterFor } from '@/lib/broadcast/server';
import { ALL_STEPS } from '@/lib/broadcast/config';
import { normalizeUrl } from '@/lib/tournaments/external';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

// Change a broadcast: any of title, starts_at, ends_at, platform, tournament_id, notes, vod_url, status ('scheduled' | 'live' | 'done' | 'cancelled'), or { check: { step, done } } for the checklist.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await broadcasterFor(id);
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown> & { check?: { step?: string; done?: boolean } };
  const { data: cur } = await a.svc.from('broadcasts').select('id, checklist, title').eq('id', id).maybeSingle();
  if (!cur) return NextResponse.json({ error: 'No such broadcast.' }, { status: 404 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.title === 'string' && b.title.trim().length >= 3) patch.title = b.title.trim().slice(0, 100);
  if (typeof b.starts_at === 'string' && !Number.isNaN(new Date(b.starts_at).getTime())) patch.starts_at = new Date(b.starts_at).toISOString();
  if ('ends_at' in b) patch.ends_at = b.ends_at && !Number.isNaN(new Date(String(b.ends_at)).getTime()) ? new Date(String(b.ends_at)).toISOString() : null;
  if (typeof b.platform === 'string' && ['twitch', 'youtube', 'both'].includes(b.platform)) patch.platform = b.platform;
  if ('tournament_id' in b) patch.tournament_id = b.tournament_id || null;
  if (typeof b.notes === 'string') patch.notes = b.notes.slice(0, 2000);
  if ('vod_url' in b) patch.vod_url = b.vod_url ? normalizeUrl(String(b.vod_url)) : null;
  if (typeof b.status === 'string' && ['scheduled', 'live', 'done', 'cancelled'].includes(b.status)) patch.status = b.status;
  if (b.check?.step && ALL_STEPS.includes(b.check.step)) patch.checklist = { ...((cur.checklist as Record<string, boolean>) ?? {}), [b.check.step]: !!b.check.done };
  const { error } = await a.svc.from('broadcasts').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not save.' }, { status: 500 });
  if (patch.status)
    await logAudit(a.svc, { actorId: a.user.id, action: 'update', entityType: 'broadcast', entityId: id, summary: `Broadcast “${cur.title}” is now ${patch.status}` });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await broadcasterFor(id);
  if ('error' in a) return a.error;
  const { data: cur } = await a.svc.from('broadcasts').select('title').eq('id', id).maybeSingle();
  await a.svc.from('broadcasts').delete().eq('id', id);
  await logAudit(a.svc, { actorId: a.user.id, action: 'delete', entityType: 'broadcast', entityId: id, summary: `Deleted broadcast “${cur?.title ?? ''}”` });
  return NextResponse.json({ ok: true });
}
