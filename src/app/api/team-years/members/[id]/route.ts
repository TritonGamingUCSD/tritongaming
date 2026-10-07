import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { authorizeQuarters } from '@/lib/members/quarters';
import { TIERS } from '@/lib/members/teamYears';
import { invalidate } from '@/lib/site/revalidate';

const UUID = /^[0-9a-f-]{36}$/i;

// Fix someone on a year's list (admin): { tier?, title?, name? }. It is then kept when the year is rebuilt.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeQuarters('setup');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { manual: true };
  if ('tier' in b) { if (!(TIERS as string[]).includes(String(b.tier))) return NextResponse.json({ error: 'Pick exec, lead or officer.' }, { status: 400 }); patch.tier = b.tier; }
  if ('title' in b) patch.title = String(b.title ?? '').trim().slice(0, 80) || null;
  if ('name' in b) { const n = String(b.name ?? '').trim().slice(0, 80); if (!n) return NextResponse.json({ error: 'Add a name.' }, { status: 400 }); patch.name = n; }
  const { data, error } = await auth.svc.from('team_year_members').update(patch).eq('id', id).select('name, start_year').maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'team year', entityId: String(data.start_year), summary: `Edited ${data.name} on a past team` });
  invalidate('board');
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeQuarters('setup');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data } = await auth.svc.from('team_year_members').delete().eq('id', id).select('name, start_year').maybeSingle();
  if (!data) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'team year', entityId: String(data.start_year), summary: `Removed ${data.name} from a past team` });
  invalidate('board');
  return NextResponse.json({ ok: true });
}
