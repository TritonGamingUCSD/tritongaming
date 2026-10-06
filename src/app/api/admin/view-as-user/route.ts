import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionRoles } from '@/lib/auth';
import { createRealClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { VIEW_USER_COOKIE, isUuid } from '@/lib/viewAs';

// Admin only: start viewing the portal as one specific person ({ userId }), or stop ({ userId: null }). It is view only: every change is refused while it is on.
export async function POST(request: Request) {
  if (!(await getSessionRoles()).some((r) => r.role === 'admin')) return NextResponse.json({ error: 'Only admins can view the portal as someone else.' }, { status: 403 });
  const { userId } = await request.json().catch(() => ({}));
  const jar = await cookies();
  if (userId === null || userId === undefined) { jar.delete(VIEW_USER_COOKIE); return NextResponse.json({ ok: true }); }
  if (!isUuid(userId)) return NextResponse.json({ error: 'Unknown person.' }, { status: 400 });
  const svc = createServiceClient();
  const { data: target } = await svc.from('profiles').select('id, display_name').eq('id', userId).maybeSingle();
  if (!target) return NextResponse.json({ error: 'Unknown person.' }, { status: 404 });
  const { data: { user } } = await (await createRealClient()).auth.getUser();
  if (user?.id === userId) { jar.delete(VIEW_USER_COOKIE); return NextResponse.json({ ok: true }); }
  jar.set(VIEW_USER_COOKIE, userId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 2 });
  jar.delete('tg_view_as');   // one preview at a time
  await logAudit(svc, { actorId: user?.id ?? null, action: 'view', entityType: 'member', entityId: userId, summary: `Viewed the portal as ${target.display_name ?? 'a member'} (view only)` });
  return NextResponse.json({ ok: true });
}
