import { logAudit } from '@/lib/audit';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { performCheckin } from '@/lib/performCheckin';
import { canCheckInNow } from '@/lib/checkinDays';

// Lets an exec/admin check someone in directly from the Event Management
// attendee list — no QR scan or online code needed, for whenever someone's
// physically there but their phone/code isn't cooperating. Deliberately
// gated tighter than the scanner (checkin capability, officer+) — this
// skips the normal proof-of-presence step entirely, so it's reserved for
// the same manage_points (exec/admin) tier as reversing a check-in. Unlike
// the scanner it also works after the event has ended (see performCheckin's
// ignoreWindow) — this is where missed check-ins get fixed afterwards.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], 'manage_points')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { ticket_id } = await request.json();
  if (!ticket_id) return NextResponse.json({ error: 'Missing ticket_id' }, { status: 400 });

  const serviceClient = createServiceClient();
  const { data: ticket } = await serviceClient
    .from('tickets')
    .select('id, user_id, status, event_id, event:events(title, points_value, start_date, end_date, requires_checkin_form, checkin_windows)')
    .eq('id', ticket_id)
    .single();

  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  const eventData = Array.isArray(ticket.event) ? ticket.event[0] : ticket.event;
  if (!(await canCheckInNow(serviceClient, ticket, eventData))) {
    return NextResponse.json({ error: ticket.status === 'used' ? 'Already checked in today.' : `This ticket is ${ticket.status}, not active — nothing to check in.` }, { status: 409 });
  }
  const { error } = await performCheckin(
    serviceClient,
    ticket,
    {
      title: eventData?.title ?? null,
      points_value: eventData?.points_value ?? 0,
      requires_checkin_form: eventData?.requires_checkin_form ?? false,
      start_date: eventData?.start_date ?? new Date().toISOString(),
      end_date: eventData?.end_date ?? null,
    },
    user.id,
    { ignoreWindow: true }
  );
  if (error) {
    const status = error.includes('already ended') ? 409 : 500;
    return NextResponse.json({ error }, { status });
  }

  await logAudit(serviceClient, { actorId: user.id, action: 'manual', entityType: 'check-in', entityId: ticket_id, summary: `Manual check-in${eventData?.title ? ` for "${eventData.title}"` : ''}` });
  return NextResponse.json({ ok: true });
}
