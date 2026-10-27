import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/portal/capabilities';
import { rotatingCode, qrToken, currentWindow, scanWindows } from '@/lib/events/rotatingCode';
import { performCheckin } from '@/lib/events/performCheckin';
import { openEventsFilter, isHappeningNow } from '@/lib/events/checkinWindow';
import { canCheckInNow, todaysCheckinAt } from '@/lib/events/checkinDays';
import { getTier, fetchTiers } from '@/lib/members/tiers';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // The person at the door is waiting on this answer, so what does not depend on something else is asked together: who may scan and what was scanned.
  const [{ data: roles }, body] = await Promise.all([
    supabase.from('user_roles').select('role, division_id').eq('user_id', user.id),
    request.json(),
  ]);

  if (!hasCapability(roles ?? [], 'checkin')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { code, qr_token: tgToken, event_id: pickedEvent, preview, confirm_event: confirmEvent } = body;   // preview: only say whose ticket it is; confirm_event: staff saw the wrong-event warning and checked in anyway
  if (!code && !tgToken) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }
  // With no event named (the portal's one code box and scanner), the ticket is looked for among the events that can still be checked into.
  const anyEvent = !pickedEvent;

  // What's scanned/typed is a short-lived rotating code (see src/lib/rotatingCode.ts),
  // not the ticket's permanent secret — that never leaves the server. Only this
  // event's tickets are read for the normal case (a scan used to read every
  // ticket in the database, which grows with the club and costs egress). Only
  // when nothing matches are the active tickets of other still-open events
  // read, so a mismatch can be reported as "wrong event" instead of a generic
  // "not recognized".
  //
  // `tickets` has TWO foreign keys into `profiles` (user_id and
  // checked_in_by), so `user:profiles(display_name)` is genuinely ambiguous
  // to PostgREST; the `!tickets_user_id_fkey` hint picks the right one.
  const columns = `
      id, ticket_code, status, checked_in_at, checked_in_by, checkin_form_completed_at, event_id, user_id,
      user:profiles!tickets_user_id_fkey(display_name),
      event:events`;
  const eventColumns = '(title, points_value, start_date, end_date, requires_checkin_form, checkin_windows)';
  // The membership tiers (for the result) are asked while the tickets are looked up, so neither waits for the other.
  const tiersPromise = preview === true ? null : fetchTiers(supabase);
  tiersPromise?.catch(() => {});
  // The portal's scanner (no event named) looks for the ticket among every ticket of the events that can still be checked into. That is the slow part of a scan, so it is kept as light as it can be:
  // the events on right now (a handful of rows, which also settle the wrong-event question) and their tickets are asked together, with just the columns needed, through the service client
  // (who may scan was checked above; the per-row access rules of the user's own client were most of the wait).
  const serviceClient = createServiceClient();
  let openEvents: { id: string; title: string | null; points_value: number; start_date: string; end_date: string | null; requires_checkin_form: boolean | null; checkin_windows: unknown }[] = [];
  type Candidate = Record<string, unknown> & { id: string; ticket_code: string; event_id: string; user_id: string; status: string; user?: unknown; event?: unknown };
  let eventTickets = null as Candidate[] | null;
  let candidatesError: unknown = null;
  if (anyEvent) {
    // Both at once: the events on right now, and their tickets with the holder's name and the event alongside (one round trip, not three).
    const [ev, tk] = await Promise.all([
      serviceClient.from('events').select('id, title, points_value, start_date, end_date, requires_checkin_form, checkin_windows').or(openEventsFilter()),
      serviceClient.from('tickets').select(`id, ticket_code, status, checked_in_at, checked_in_by, checkin_form_completed_at, event_id, user_id, user:profiles!tickets_user_id_fkey(display_name), event:events!inner${eventColumns}`).or(openEventsFilter(), { referencedTable: 'events' }),
    ]);
    candidatesError = ev.error ?? tk.error;
    openEvents = (ev.data ?? []) as typeof openEvents;
    eventTickets = (tk.data ?? []) as unknown as Candidate[];
  } else {
    const q = await supabase.from('tickets').select(`${columns}${eventColumns}`).eq('event_id', pickedEvent);
    eventTickets = q.data as Candidate[] | null; candidatesError = q.error;
  }

  if (candidatesError) {
    console.error('[checkin] failed to load candidate tickets:', candidatesError);
    return NextResponse.json({ error: 'Failed to look up tickets. Please try again.' }, { status: 500 });
  }

  // Scanned QR data is prefixed with the event's slug (`slug:code`, see
  // src/app/api/tickets/[id]/qr/route.ts) purely as a human/scanner-visible
  // hint of which event it's for — it isn't part of the HMAC and carries no
  // authority, so it's simply dropped here before the real check.
  // Two ways in, kept apart: the six typed digits, or the key from a TGcode (`t` and 8 hex digits, or 12 from a code of the first format, which only the portal's scanner reads).
  const windowIndex = currentWindow();
  let matches: (t: { id?: string; ticket_code: string }) => boolean;
  if (tgToken) {
    const tok = String(tgToken).trim().toLowerCase();
    if (!/^([0-9a-f]{8}|[0-9a-f]{12})$/.test(tok)) return NextResponse.json({ error: 'That isn’t a ticket.' }, { status: 400 });
    const wins = scanWindows();   // about 30 s, not 60 (see rotatingCode)
    matches = (t) => wins.some((w) => qrToken(t.ticket_code, w).slice(0, tok.length) === tok);
  } else {
    const raw = String(code).trim().replace(/^#\s*/, '');
    const normalizedCode = raw.includes(':') ? raw.slice(raw.lastIndexOf(':') + 1) : raw;
    matches = (t) => rotatingCode(t.ticket_code, windowIndex) === normalizedCode || rotatingCode(t.ticket_code, windowIndex - 1) === normalizedCode;
  }

  const ticket = (eventTickets ?? []).find(matches);
  const event_id = pickedEvent ?? ticket?.event_id;

  if (!ticket && anyEvent) return NextResponse.json({ error: 'Code not recognized — ask them to reopen their ticket and try again' }, { status: 404 });
  if (!ticket) {
    const { data: others } = await supabase
      .from('tickets')
      .select('id, ticket_code, event:events!inner(title)')
      .neq('event_id', event_id)
      .eq('status', 'active')
      .or(openEventsFilter(), { referencedTable: 'events' });
    const wrongEventTicket = (others ?? []).find(matches);
    if (wrongEventTicket) {
      const wrongEventData = Array.isArray(wrongEventTicket.event) ? wrongEventTicket.event[0] : wrongEventTicket.event;
      return NextResponse.json(
        { error: `This ticket is for a different event — ${wrongEventData?.title || 'another event'}. Switch events above to check them in.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Code not recognized — ask them to reopen their ticket and try again' }, { status: 404 });
  }

  const userData = Array.isArray(ticket.user) ? ticket.user[0] : ticket.user;
  const eventData = Array.isArray(ticket.event) ? ticket.event[0] : ticket.event;

  if (preview === true) return NextResponse.json({ preview: true, user_name: userData?.display_name || 'Unknown', event_title: eventData?.title || '' });

  // From the portal's one scanner (no event chosen): a ticket for an event that is not the one on right now is not checked in until staff say so, so a ticket for tomorrow's (or last week's) event
  // shown by mistake does not quietly check someone into it. Nothing is asked when no event is on right now, or when this ticket's event is one of those on.
  if (anyEvent && confirmEvent !== true) {
    const live = openEvents.filter((e) => isHappeningNow(e));
    if (live.length > 0 && !live.some((e) => e.id === ticket.event_id)) {
      return NextResponse.json({ code: 'confirm_event', error: 'Wrong event?', user_name: userData?.display_name || 'Unknown', event_title: eventData?.title || '', now_event: live.map((e) => e.title).join(' and ') }, { status: 409 });
    }
  }

  if (!(await canCheckInNow(serviceClient, ticket, eventData))) {
    return NextResponse.json({
      status: ticket.status,
      event_title: eventData?.title || '',
      user_name: userData?.display_name || 'Unknown',
      // For a multi-day event this is today's scan; otherwise the (first) check-in.
      checked_in_at: (await todaysCheckinAt(serviceClient, ticket.id)) ?? ticket.checked_in_at,
      // Lets the scanner tell staff whether this (already checked-in)
      // person still owes the AS Form.
      requires_form: !!eventData?.requires_checkin_form,
      form_completed: !!ticket.checkin_form_completed_at,
      // They checked themselves in (their own scan or code), not staff — shown next to the time.
      self_checkin: !!ticket.checked_in_by && ticket.checked_in_by === ticket.user_id,
    });
  }

  // RLS only lets someone insert a notification for themselves (see
  // 20260920022210_allow_self_insert_notifications.sql) and
  // award_checkin_points is a security-definer RPC — both genuinely need
  // the service-role client, not the officer's own.
  const { error: checkinError, firstCheckin, day } = await performCheckin(
    serviceClient,
    ticket,
    {
      title: eventData?.title ?? null,
      points_value: eventData?.points_value ?? 0,
      requires_checkin_form: eventData?.requires_checkin_form ?? false,
      start_date: eventData?.start_date ?? new Date().toISOString(),
      end_date: eventData?.end_date ?? null,
      checkin_windows: (eventData as { checkin_windows?: { day: string; start: string; end: string }[] } | null)?.checkin_windows ?? [],
    },
    user.id
  );
  if (checkinError) {
    // "Event ended" is a deterministic rejection, not a transient server
    // failure — 409 (not 500) so fetchWithRetry's retry-on-5xx logic
    // doesn't waste 3 attempts retrying something that'll never succeed.
    const status = (checkinError.includes('already ended') || checkinError.startsWith('Check-in for today') || checkinError.startsWith('Already')) ? 409 : 500;
    return NextResponse.json({ error: checkinError }, { status });
  }

  // Best-effort — the check-in itself already succeeded above, so a
  // failure to read back the new total shouldn't turn into a 500 for
  // something that already worked. The scanner UI just won't show the
  // points animation for this scan if these come back empty.
  const [{ data: allAmounts }, tiers] = await Promise.all([serviceClient.from('point_transactions').select('amount, reversed_at').eq('user_id', ticket.user_id), tiersPromise ?? fetchTiers(supabase)]);
  const lifetimeEarned = (allAmounts ?? []).filter((t) => t.amount > 0 && !t.reversed_at).reduce((sum, t) => sum + t.amount, 0);

  return NextResponse.json({
    status: 'active',
    event_title: eventData?.title || '',
    user_name: userData?.display_name || 'Unknown',
    ticket_id: ticket.id,
    // Just checked in, so the form can't be done yet — staff use this to
    // point the attendee to the AS Form step before they head in.
    requires_form: !!eventData?.requires_checkin_form,
    form_completed: false,
    points_awarded: firstCheckin === false ? 0 : (eventData?.points_value ?? 0),
    // Multi-day events: which day this scan counts for (shown on the scanner result).
    day_number: day?.day ?? null,
    day_total: day?.total ?? null,
    later_day: firstCheckin === false,
    lifetime_points: lifetimeEarned,
    tier: getTier(lifetimeEarned, tiers).name,
  });
}
