import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { strictUser } from '@/lib/supabase/localAuth';
import { canDivisionAction } from '@/lib/portal/divisionAccess';
import { loadGrantedCapabilities } from '@/lib/portal/grantedCapabilities';
import { withGrantedCapabilities } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';
import { createNotifications } from '@/lib/notifications/notify';

export const dynamic = 'force-dynamic';

async function who(id: string, action: 'see_home' | 'post_announcements') {
  const userClient = await createClient();
  const {
    data: { user },
  } = await strictUser(userClient);
  if (!user || user.is_anonymous) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const svc = createServiceClient();
  const { data: mine } = await userClient.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const roles = withGrantedCapabilities(mine ?? [], await loadGrantedCapabilities(svc, user.id).catch(() => []));
  if (!canDivisionAction(roles, id, action))
    return { error: NextResponse.json({ error: action === 'post_announcements' ? 'Only the division’s Heads can post announcements.' : 'Forbidden' }, { status: 403 }) };
  return { user, svc };
}

// The division's announcements, newest first. For everyone in the division (and exec and admin).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await who(id, 'see_home');
  if ('error' in w) return w.error;
  const { data } = await w.svc.from('division_announcements').select('id, title, body, created_at').eq('division_id', id).order('created_at', { ascending: false }).limit(20);
  return NextResponse.json({ announcements: data ?? [] });
}

// Post one (Heads): { title, body? }. The division's Members and Heads get a notification.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await who(id, 'post_announcements');
  if ('error' in w) return w.error;
  const b = (await request.json().catch(() => ({}))) as { title?: string; body?: string };
  const title = (b.title ?? '').trim().slice(0, 120);
  if (!title) return NextResponse.json({ error: 'Give the announcement a title.' }, { status: 400 });
  const body = (b.body ?? '').trim().slice(0, 2000);
  const { data, error } = await w.svc.from('division_announcements').insert({ division_id: id, author_id: w.user.id, title, body }).select('id, title, body, created_at').single();
  if (error) return NextResponse.json({ error: 'Could not post that. Try again.' }, { status: 500 });
  const { data: division } = await w.svc.from('divisions').select('name, slug').eq('id', id).maybeSingle();
  const { data: people } = await w.svc.from('user_roles').select('user_id').eq('division_id', id).in('role', ['division', 'division_member']);
  const ids = [...new Set((people ?? []).map((p) => p.user_id as string))].filter((u) => u !== w.user.id);
  await createNotifications(
    w.svc,
    ids.map((u) => ({
      user_id: u,
      type: 'division_announcement',
      title: `${division?.name ?? 'Division'}: ${title}`,
      body: body.slice(0, 120) || null,
      href: division ? `/portal/${division.slug}` : null,
    })),
  );
  await logAudit(w.svc, {
    actorId: w.user.id,
    action: 'create',
    entityType: 'division announcement',
    entityId: data.id as string,
    summary: `Posted a division announcement “${title}”`,
  });
  return NextResponse.json({ announcement: data }, { status: 201 });
}

// Remove one (Heads): { id }.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await who(id, 'post_announcements');
  if ('error' in w) return w.error;
  const b = (await request.json().catch(() => ({}))) as { id?: string };
  if (!b.id) return NextResponse.json({ error: 'Say which one.' }, { status: 400 });
  await w.svc.from('division_announcements').delete().eq('id', b.id).eq('division_id', id);
  return NextResponse.json({ ok: true });
}
