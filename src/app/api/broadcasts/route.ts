import { NextResponse } from 'next/server';
import { broadcaster } from '@/lib/broadcast/server';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

// The schedule: what is live or coming up, and the last few that happened, each with who has which role.
export async function GET() {
  const a = await broadcaster();
  if ('error' in a) return a.error;
  const { data: rows } = await a.svc.from('broadcasts').select('*').order('starts_at', { ascending: false }).limit(60);
  const ids = (rows ?? []).map((r) => r.id as string);
  const { data: roles } = ids.length ? await a.svc.from('broadcast_roles').select('id, broadcast_id, role, user_id, name').in('broadcast_id', ids) : { data: [] };
  const userIds = [...new Set((roles ?? []).map((r) => r.user_id as string | null).filter((x): x is string => !!x))];
  const { data: profs } = userIds.length ? await a.svc.from('profiles').select('id, display_name, google_first_name').in('id', userIds) : { data: [] };
  const nameOf = new Map((profs ?? []).map((p) => [p.id as string, (p.display_name as string) || (p.google_first_name as string) || 'Member']));
  const { data: tourneys } = await a.svc.from('tournaments').select('id, name, slug').order('created_at', { ascending: false }).limit(40);
  return NextResponse.json({
    broadcasts: (rows ?? []).map((r) => ({
      ...r,
      roles: (roles ?? [])
        .filter((x) => x.broadcast_id === r.id)
        .map((x) => ({ id: x.id, role: x.role, user_id: x.user_id, name: x.user_id ? (nameOf.get(x.user_id as string) ?? x.name) : x.name })),
    })),
    tournaments: tourneys ?? [],
  });
}

// { title, starts_at, ends_at?, platform?, tournament_id?, notes? }
export async function POST(request: Request) {
  const a = await broadcaster();
  if ('error' in a) return a.error;
  const b = (await request.json().catch(() => ({}))) as { title?: string; starts_at?: string; ends_at?: string; platform?: string; tournament_id?: string; notes?: string };
  const title = String(b.title ?? '')
    .trim()
    .slice(0, 100);
  if (title.length < 3) return NextResponse.json({ error: 'Give the broadcast a title.' }, { status: 400 });
  const start = b.starts_at ? new Date(b.starts_at) : null;
  if (!start || Number.isNaN(start.getTime())) return NextResponse.json({ error: 'Pick when it starts.' }, { status: 400 });
  const end = b.ends_at ? new Date(b.ends_at) : null;
  if (end && (Number.isNaN(end.getTime()) || end <= start)) return NextResponse.json({ error: 'It has to end after it starts.' }, { status: 400 });
  const { data, error } = await a.svc
    .from('broadcasts')
    .insert({
      title,
      starts_at: start.toISOString(),
      ends_at: end?.toISOString() ?? null,
      platform: ['twitch', 'youtube', 'both'].includes(b.platform ?? '') ? b.platform : 'both',
      tournament_id: b.tournament_id || null,
      notes: String(b.notes ?? '').slice(0, 2000),
      created_by: a.user.id,
    })
    .select('id')
    .single();
  if (error || !data) return NextResponse.json({ error: 'Could not save it.' }, { status: 500 });
  await logAudit(a.svc, { actorId: a.user.id, action: 'create', entityType: 'broadcast', entityId: data.id, summary: `Scheduled broadcast “${title}”` });
  return NextResponse.json({ ok: true, id: data.id });
}
