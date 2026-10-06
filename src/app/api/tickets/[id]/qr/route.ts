import { NextResponse } from 'next/server';
import { canCheckInNow } from '@/lib/checkinDays';
import { createClient } from '@/lib/supabase/server';
import { rotatingCode, currentWindow, secondsUntilNextWindow, ROTATION_SECONDS } from '@/lib/rotatingCode';

export const runtime = 'nodejs';

// 90 minutes of 30s windows.
const AHEAD_WINDOWS = 180;

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ticket } = await supabase
    .from('tickets')
    .select('id, user_id, ticket_code, status, event:events(slug, start_date, end_date)')
    .eq('id', id)
    .single();

  // Deliberately owner-only, even though staff can read tickets via RLS for
  // check-in — nobody but the attendee should be able to mint their live code.
  if (!ticket || ticket.user_id !== user.id) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }
  const evForDays = (Array.isArray(ticket.event) ? ticket.event[0] : ticket.event) as { start_date: string; end_date: string | null } | null;
  if (!(await canCheckInNow(supabase, ticket, evForDays))) {
    return NextResponse.json({ error: 'Ticket is not active' }, { status: 400 });
  }

  // Does this member currently hold a fulfilled reward that grants a Fast
  // Pass? Checked against the member Rewards shop — see 20260921105000_add_digital_rewards.sql's grants_fast_pass flag.
  // Not scoped to this specific event; it's a standing perk, not a
  // per-event consumable.
  const { data: memberFastPass } = await
  supabase
      .from('reward_redemptions')
      .select('id, reward:reward_items!inner(grants_fast_pass)')
      .eq('user_id', user.id)
      .eq('status', 'fulfilled')
      .eq('reward.grants_fast_pass', true)
      .limit(1);
  const hasFastPass = (memberFastPass?.length ?? 0) > 0;

  const event = Array.isArray(ticket.event) ? ticket.event[0] : ticket.event;
  const code = rotatingCode(ticket.ticket_code, currentWindow());
  // The QR payload is prefixed with the event's slug so scanning it (with any
  // scanner, not just this app's) makes it unmistakable which event it's
  // for — see src/app/api/tickets/checkin/route.ts, which strips this prefix
  // before verifying the actual rotating code. `code` alone (no prefix) is
  // still returned for the manual-entry fallback text on screen.
  const qrData = event?.slug ? `${event.slug}:${code}` : code;
  // rotation_seconds lets the client pace the countdown ring correctly —
  // opening the ticket mid-window means expires_in is only whatever's left
  // of the *current* global window (could be anywhere from 1s to the full
  // length), not always a fresh full cycle. Without knowing the full cycle
  // length too, the client can't tell "3 seconds left of a 30s window" apart
  // from "a 3-second window," and would replay its entire visual countdown
  // compressed into just those 3 seconds — which is exactly the "suddenly
  // accelerates" glitch reported, especially right after first opening.
  // Optional look-ahead batch (?ahead=1): the codes for each upcoming window,
  // so the phone can keep showing a valid QR through a dead-signal stretch
  // (venue Wi-Fi/cell) and open the ticket instantly. Each code is still only
  // *accepted* during its own 30s window (see api/tickets/checkin), and the
  // ticket can only be checked in once, so handing the owner the next stretch
  // of codes doesn't let a screenshot from earlier work later. Only the owner
  // ever reaches this point (checked above).
  const wantsAhead = new URL(request.url).searchParams.get('ahead') === '1';
  const w0 = currentWindow();
  const upcoming = wantsAhead
    ? Array.from({ length: AHEAD_WINDOWS }, (_, i) => {
        const c = rotatingCode(ticket.ticket_code, w0 + i);
        return { w: w0 + i, code: c, qr_data: event?.slug ? `${event.slug}:${c}` : c };
      })
    : undefined;

  return NextResponse.json({
    code, qr_data: qrData, expires_in: secondsUntilNextWindow(), rotation_seconds: ROTATION_SECONDS, has_fast_pass: hasFastPass,
    ...(upcoming ? { upcoming, server_now_ms: Date.now() } : {}),
  });
}
