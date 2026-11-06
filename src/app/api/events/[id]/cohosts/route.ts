import { guardFeature } from '@/lib/portal/featureGuard';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { canManageEvent } from '@/lib/events/eventAccess';
import { canActInDivision } from '@/lib/portal/divisionAccess';
import { hasCapability, type RoleGrant } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';
import { invalidate } from '@/lib/site/revalidate';

export const dynamic = 'force-dynamic';

// Co-hosts of one event. The owner (Triton Gaming or a division) invites another division (or Triton Gaming, `division_id: null`) and that side accepts; an accepted co-host shows on the event and lists it on
// its own Events page. The owner's managers invite and remove; the invited side's managers (a division's Heads, or Triton Gaming's event managers) accept, decline and leave. Exec and admin do all of it.
async function who() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await strictUser(supabase);
  if (!user || user.is_anonymous) return null;
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  return { user, roles: (roles ?? []) as RoleGrant[] };
}
const mayAct = (roles: RoleGrant[], divisionId: string | null) => (divisionId ? canActInDivision(roles, divisionId, 'head') : hasCapability(roles, 'manage_events'));

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await who();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const svc = createServiceClient();
  const { data: event } = await svc.from('events').select('division_id').eq('id', id).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const { data: rows } = await svc.from('event_cohosts').select('division_id, status').eq('event_id', id);
  const mine =
    canManageEvent(me.roles, { division_id: (event.division_id as string | null) ?? null }) || (rows ?? []).some((r) => mayAct(me.roles, (r.division_id as string | null) ?? null));
  if (!mine) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ cohosts: rows ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const off = await guardFeature('div_cohost');
  if (off) return off;
  const { id } = await params;
  const me = await who();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { division_id?: string | null };
  const target = body.division_id ?? null;
  const svc = createServiceClient();
  const { data: event } = await svc.from('events').select('title, division_id').eq('id', id).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  const owner = (event.division_id as string | null) ?? null;
  if (!canManageEvent(me.roles, { division_id: owner })) return NextResponse.json({ error: 'Only the hosts can invite co-hosts.' }, { status: 403 });
  if (target === owner) return NextResponse.json({ error: 'That is already the host.' }, { status: 400 });
  if (target) {
    const { data: d } = await svc.from('divisions').select('id').eq('id', target).maybeSingle();
    if (!d) return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  }
  const { data: have } = await svc
    .from('event_cohosts')
    .select('status')
    .eq('event_id', id)
    .filter('division_id', target ? 'eq' : 'is', target ?? null)
    .maybeSingle();
  if (have) return NextResponse.json({ error: have.status === 'accepted' ? 'Already a co-host.' : 'Already invited.' }, { status: 409 });
  // The other side is asked, unless the person is exec or admin who may act for that side too.
  const staff = me.roles.some((r) => r.role === 'exec' || r.role === 'admin');
  const status = staff && mayAct(me.roles, target) ? 'accepted' : 'invited';
  const { error } = await svc.from('event_cohosts').insert({ event_id: id, division_id: target, status, invited_by: me.user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit(svc, { actorId: me.user.id, action: 'update', entityType: 'event', entityId: id, summary: `Invited a co-host to "${event.title}"` });
  invalidate('events');
  return NextResponse.json({ ok: true, status });
}

// { division_id, action: 'accept' } from the invited side. Declining or leaving is DELETE.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await who();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { division_id?: string | null; action?: string };
  const target = body.division_id ?? null;
  if (body.action !== 'accept') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  if (!mayAct(me.roles, target)) return NextResponse.json({ error: 'Only the invited host’s managers can accept.' }, { status: 403 });
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('event_cohosts')
    .update({ status: 'accepted' })
    .eq('event_id', id)
    .filter('division_id', target ? 'eq' : 'is', target ?? null)
    .select('event_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'No such invitation.' }, { status: 404 });
  const { data: ev } = await svc.from('events').select('title').eq('id', id).maybeSingle();
  await logAudit(svc, { actorId: me.user.id, action: 'update', entityType: 'event', entityId: id, summary: `Accepted co-hosting "${ev?.title ?? 'an event'}"` });
  invalidate('events');
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await who();
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { division_id?: string | null };
  const target = body.division_id ?? null;
  const svc = createServiceClient();
  const { data: event } = await svc.from('events').select('title, division_id').eq('id', id).maybeSingle();
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  if (!mayAct(me.roles, target) && !canManageEvent(me.roles, { division_id: (event.division_id as string | null) ?? null }))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await svc
    .from('event_cohosts')
    .delete()
    .eq('event_id', id)
    .filter('division_id', target ? 'eq' : 'is', target ?? null);
  await logAudit(svc, { actorId: me.user.id, action: 'update', entityType: 'event', entityId: id, summary: `Removed a co-host from "${event.title}"` });
  invalidate('events');
  return NextResponse.json({ ok: true });
}
