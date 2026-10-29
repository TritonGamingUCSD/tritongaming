import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { logAudit } from '@/lib/notifications/audit';
import { SELF_CHECKIN_MODES, SELF_CHECKIN_LABELS, type SelfCheckinMode } from '@/lib/events/selfCheckin';

// Sets self check-in for one event: off, on until the event ends, or on with no end. Only exec and admin can change it (the same people who can check someone in
// by hand or undo a check-in). Officers can see the QR on the Check-In tab but not change this.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_points')) return NextResponse.json({ error: 'Only exec and admin can change self check-in.' }, { status: 403 });

  const { mode } = (await request.json().catch(() => ({}))) as { mode?: SelfCheckinMode };
  if (!mode || !SELF_CHECKIN_MODES.includes(mode)) return NextResponse.json({ error: 'Missing or invalid mode' }, { status: 400 });

  const svc = createServiceClient();
  const { data: event, error } = await svc.from('events').update({ self_checkin_mode: mode }).eq('id', id).select('title').maybeSingle();
  if (error || !event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  await logAudit(svc, {
    actorId: user.id,
    action: 'update',
    entityType: 'event',
    entityId: id,
    summary: `Self check-in set to "${SELF_CHECKIN_LABELS[mode]}" for "${event.title}"`,
  });
  return NextResponse.json({ ok: true, mode });
}
