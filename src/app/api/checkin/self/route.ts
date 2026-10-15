import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { createNotifications } from '@/lib/notifications/notify';
import { isVerifiedMember } from '@/lib/portal/capabilities';
import { hasBasicProfileInfo } from '@/lib/members/profile';
import { isCheckinWindowOpen } from '@/lib/events/checkinWindow';
import { canCheckInNow } from '@/lib/events/checkinDays';
import { performCheckin } from '@/lib/events/performCheckin';

// Self check-in: a person scans the event's QR with their own phone, signs in, and is checked in. It is a second way in alongside the staff scanner and
// uses the same steps (performCheckin: window, ticket flips to used, points, notification), so staff scanning is untouched. It only works for events whose
// self check-in switch is on, and only until the event's check-in window closes.
//
// If the person has no ticket yet, a free one is issued here (UCSD students, or any event with no price). A priced ticket still goes through the normal
// ticket flow with Stripe: this route does not take payment.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 });

  const { event_id } = await request.json().catch(() => ({}));
  if (!event_id || typeof event_id !== 'string') return NextResponse.json({ error: 'Missing event_id' }, { status: 400 });

  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id, title, points_value, start_date, end_date, requires_checkin_form, checkin_windows, self_checkin_enabled, is_published, audience, ticket_price')
    .eq('id', event_id)
    .maybeSingle();
  if (!event || !event.is_published) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  if (!event.self_checkin_enabled) return NextResponse.json({ error: "Self check-in isn't open for this event. Please see a staff member.", code: 'closed' }, { status: 403 });
  if (!isCheckinWindowOpen(event)) return NextResponse.json({ error: 'This event has already ended.', code: 'ended' }, { status: 409 });

  // The same profile rule as claiming a ticket, so the reports stay complete.
  const [{ data: profile }, { data: roles }, { data: priv }] = await Promise.all([
    svc.from('profiles').select('display_name, major, year, college, pronouns').eq('id', user.id).single(),
    svc.from('user_roles').select('role, division_id').eq('user_id', user.id),
    svc.from('profile_private').select('gender').eq('user_id', user.id).maybeSingle(),
  ]);
  const isUcsd = isVerifiedMember(roles ?? []);
  if (!profile || !hasBasicProfileInfo({ ...profile, gender: priv?.gender ?? null }, isUcsd)) {
    return NextResponse.json({ error: 'Please finish your profile first.', code: 'needs_profile' }, { status: 400 });
  }
  if (event.audience === 'ucsd_only' && !isUcsd) {
    return NextResponse.json({ error: 'This event is open to UCSD-affiliated members only.', code: 'ucsd_only' }, { status: 403 });
  }

  let { data: ticket } = await svc.from('tickets').select('id, user_id, event_id, status, checked_in_at').eq('event_id', event.id).eq('user_id', user.id).maybeSingle();

  if (!ticket) {
    const price = isUcsd ? 0 : (event.ticket_price ?? 0);
    if (price > 0) {
      return NextResponse.json({ error: 'This event has a ticket price. Get your ticket first, then check in.', code: 'needs_payment' }, { status: 402 });
    }
    const { data: created, error } = await svc.from('tickets').insert({ event_id: event.id, user_id: user.id, source: 'self_checkin' }).select('id, user_id, event_id, status, checked_in_at').single();
    if (error) {
      // Two taps at once: the other one made the ticket.
      if (error.code === '23505') {
        ({ data: ticket } = await svc.from('tickets').select('id, user_id, event_id, status, checked_in_at').eq('event_id', event.id).eq('user_id', user.id).maybeSingle());
      }
      if (!ticket) return NextResponse.json({ error: 'Could not create your ticket. Please try again or see a staff member.' }, { status: 500 });
    } else {
      ticket = created;
      await createNotifications(svc, [{ user_id: user.id, type: 'ticket_confirmed', title: 'Ticket confirmed', body: `You're registered for ${event.title}.`, href: '/portal/tickets' }]);
    }
  }
  if (!ticket) return NextResponse.json({ error: 'Could not find your ticket.' }, { status: 500 });

  if (ticket.status === 'cancelled') return NextResponse.json({ error: 'This ticket is no longer valid. Please see a staff member.' }, { status: 409 });

  // Already in (staff scanned them, or they tapped twice): that is a success, not an error. They just see their checked-in screen.
  if (!(await canCheckInNow(svc, ticket, event))) {
    return NextResponse.json({ status: 'already', checked_in_at: ticket.checked_in_at, ticket_id: ticket.id, event_title: event.title });
  }

  const result = await performCheckin(
    svc,
    ticket,
    { title: event.title, points_value: event.points_value, start_date: event.start_date, end_date: event.end_date, requires_checkin_form: event.requires_checkin_form, checkin_windows: event.checkin_windows },
    user.id,
  );
  if (result.error) {
    if (result.error.startsWith('Already')) return NextResponse.json({ status: 'already', ticket_id: ticket.id, event_title: event.title });
    const status = result.error.includes('already ended') || result.error.startsWith('Check-in') ? 409 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ status: 'checked_in', ticket_id: ticket.id, event_title: event.title, checked_in_at: new Date().toISOString(), day: result.day ?? null });
}
