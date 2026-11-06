import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { canDivisionAction } from '@/lib/portal/divisionAccess';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { withGrantedCapabilities } from '@/lib/portal/capabilities';
import { withRole, type RoleRow } from '@/lib/portal/roleGrant';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { logAudit } from '@/lib/notifications/audit';
import { createNotifications } from '@/lib/notifications/notify';

export const dynamic = 'force-dynamic';

async function head(id: string) {
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = createServiceClient();
  const { data: mine } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const roles = withGrantedCapabilities(mine ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  if (!canDivisionAction(roles, id, 'manage_members')) return { error: NextResponse.json({ error: 'Only the division’s Heads can answer join requests.' }, { status: 403 }) };
  return { user, svc };
}

// The requests waiting for this division's Heads (names and pictures, and what the person wrote).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await head(id);
  if ('error' in h) return h.error;
  const { data: div } = await h.svc.from('divisions').select('join_open').eq('id', id).maybeSingle();
  const { data: rows } = await h.svc.from('division_join_requests').select('id, user_id, message, created_at').eq('division_id', id).eq('status', 'pending').order('created_at');
  const ids = (rows ?? []).map((r) => r.user_id as string);
  const { data: profiles } = ids.length ? await h.svc.from('profiles').select('id, display_name, google_first_name, custom_avatar_url, avatar_url').in('id', ids) : { data: [] };
  const by = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  return NextResponse.json({
    open: div?.join_open !== false,
    requests: (rows ?? []).map((r) => {
      const p = by.get(r.user_id as string);
      return {
        id: r.id as string,
        user_id: r.user_id as string,
        name: (p?.display_name as string | null) || (p?.google_first_name as string | null) || 'Unnamed',
        avatarUrl: p ? resolveAvatarUrl(p as Parameters<typeof resolveAvatarUrl>[0]) : null,
        message: (r.message as string | null) ?? '',
        at: r.created_at as string,
      };
    }),
  });
}

// { id, action: 'approve' | 'decline' }: approving makes them a Member; either way they are told.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await head(id);
  if ('error' in h) return h.error;
  const b = (await request.json().catch(() => ({}))) as { id?: string; action?: string };
  if (!b.id || !['approve', 'decline'].includes(b.action ?? '')) return NextResponse.json({ error: 'Say which request and what to do.' }, { status: 400 });
  const { data: req } = await h.svc.from('division_join_requests').select('id, user_id, status').eq('id', b.id).eq('division_id', id).maybeSingle();
  if (!req || req.status !== 'pending') return NextResponse.json({ error: 'That request was already answered.' }, { status: 404 });
  const { data: division } = await h.svc.from('divisions').select('name, slug').eq('id', id).maybeSingle();
  if (b.action === 'approve') {
    const { data: current } = await h.svc.from('user_roles').select('role, division_id').eq('user_id', req.user_id);
    const next = withRole((current ?? []) as RoleRow[], 'division_member', id);
    if (next) {
      const { error } = await h.svc.rpc('admin_set_user_roles', { _user_id: req.user_id, _roles: next, _granted_by: h.user.id });
      if (error) return NextResponse.json({ error: 'Could not add them. Try again.' }, { status: 500 });
    }
  }
  await h.svc
    .from('division_join_requests')
    .update({ status: b.action === 'approve' ? 'approved' : 'declined', decided_by: h.user.id, decided_at: new Date().toISOString() })
    .eq('id', req.id);
  await logAudit(h.svc, {
    actorId: h.user.id,
    action: 'update',
    entityType: 'role',
    entityId: req.user_id as string,
    summary: `${b.action === 'approve' ? 'Approved' : 'Declined'} a request to join a division`,
  });
  await createNotifications(h.svc, [
    {
      user_id: req.user_id as string,
      type: 'division_join',
      title: b.action === 'approve' ? `You are in ${division?.name ?? 'the division'}` : `Your request to join ${division?.name ?? 'the division'} was declined`,
      href: b.action === 'approve' && division ? `/portal/${division.slug}` : null,
    },
  ]);
  return NextResponse.json({ ok: true });
}

// { open: boolean }: take join requests, or stop taking them (a full division). Waiting requests stay for the Heads to answer.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await head(id);
  if ('error' in h) return h.error;
  const b = (await request.json().catch(() => ({}))) as { open?: boolean };
  if (typeof b.open !== 'boolean') return NextResponse.json({ error: 'Say open or closed.' }, { status: 400 });
  const { error } = await h.svc.from('divisions').update({ join_open: b.open }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 });
  await logAudit(h.svc, {
    actorId: h.user.id,
    action: 'update',
    entityType: 'division',
    entityId: id,
    summary: b.open ? 'Opened a division to join requests' : 'Closed a division to join requests',
  });
  return NextResponse.json({ ok: true, open: b.open });
}
