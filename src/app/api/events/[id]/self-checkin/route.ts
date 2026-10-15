import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';

// Turns self check-in on or off for one event. Same people who run the door (the check-in capability) can do it, so it can be switched on at doors-open.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'checkin')) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

  const { enabled } = await request.json().catch(() => ({}));
  if (typeof enabled !== 'boolean') return NextResponse.json({ error: 'Missing enabled' }, { status: 400 });

  const svc = createServiceClient();
  const { data: event, error } = await svc.from('events').update({ self_checkin_enabled: enabled }).eq('id', id).select('title').maybeSingle();
  if (error || !event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  await logAudit(svc, { actorId: user.id, action: 'update', entityType: 'event', entityId: id, summary: `Self check-in ${enabled ? 'turned on' : 'turned off'} for "${event.title}"` });
  return NextResponse.json({ ok: true, enabled });
}
