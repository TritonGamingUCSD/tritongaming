import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildCheckinFormUrl, type CheckinFormConfig } from '@/lib/checkinForm';
import type { AppRole } from '@/types/database';
import { fetchTiers, getTier, nextTier } from '@/lib/tiers';
import { isMultiDayEvent, todaysCheckinAt, currentDayInfo, pacificDayKey } from '@/lib/checkinDays';

export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

// Deliberately tiny/cheap — polled every few seconds by FullscreenQR as a
// backstop for the Realtime subscription (see enable_tickets_realtime
// migration). Realtime pushes the "checked in" update instantly when it's
// working; this guarantees the screen still catches up within a few seconds
// even if a Realtime connection never established (flaky network, a
// misbehaving proxy blocking websockets, etc.).
//
// Also the authoritative answer to "does this event need the AS Form, and
// where is it" — computed fresh here rather than trusting the URL baked into
// the page at load time, since a check-in screen can sit open long after
// that page loaded (or the event's form settings can change under it).
// Only does the extra queries once the ticket is actually checked in, so
// the every-4-seconds poll stays as cheap as before for everyone else.
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ticket } = await supabase
    .from('tickets')
    .select('user_id, status, checked_in_at, checkin_form_completed_at, event:events(title, start_date, end_date, requires_checkin_form, checkin_food_item, checkin_form_event_name, checkin_form_override)')
    .eq('id', id)
    .single();

  if (!ticket || ticket.user_id !== user.id) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  // Multi-day events: a ticket that's 'used' from an earlier day still needs scanning today.
  const multiDay = !!(ticket.event as unknown as { start_date: string; end_date: string | null } | null) &&
    isMultiDayEvent((ticket.event as unknown as { start_date: string }).start_date, (ticket.event as unknown as { end_date: string | null }).end_date);
  const todayAt = ticket.status === 'used' && multiDay ? await todaysCheckinAt(supabase, id) : null;
  const checkedInToday = multiDay ? todayAt !== null : ticket.status === 'used';
  // Points are earned on the first day only, so a later day's success screen shows none.
  const laterDay = multiDay && ticket.status === 'used' && !!ticket.checked_in_at && pacificDayKey(new Date(ticket.checked_in_at)) !== pacificDayKey();

  let checkinFormUrl: string | null = null;
  const event = ticket.event as unknown as {
    title: string;
    start_date: string;
    end_date: string | null;
    requires_checkin_form: boolean;
    checkin_food_item: string | null;
    checkin_form_event_name: string | null;
    checkin_form_override: CheckinFormConfig | null;
  } | null;

  if (ticket.status === 'used' && event?.requires_checkin_form) {
    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      supabase.from('profiles').select('year, class_of').eq('id', user.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', user.id),
    ]);
    // Per-event config only — the form link differs for each event.
    const config = event.checkin_form_override;
    if (config) {
      checkinFormUrl = buildCheckinFormUrl(config, {
        eventTitle: event.checkin_form_event_name?.trim() || event.title,
        year: profile?.year ?? null,
        classOf: profile?.class_of ?? null,
        roles: (roleRows ?? []).map((r) => r.role as AppRole),
        foodItem: event.checkin_food_item ?? null,
      });
    }
  }

  // Points this check-in earned, for the member's success screen — only
  // looked up once checked in. 0 for a non-rewards-eligible member or a
  // zero-point event (no ledger row), which the UI simply doesn't show.
  let pointsAwarded = 0;
  if (ticket.status === 'used' && !laterDay) {
    const { data: pointRows } = await supabase
      .from('point_transactions')
      .select('amount')
      .eq('ticket_id', id)
      .eq('type', 'event_checkin')
      .is('reversed_at', null);
    pointsAwarded = (pointRows ?? []).reduce((sum, r) => sum + r.amount, 0);
  }

  // Where those points leave them on the status ladder — lifetime points
  // (positive, un-reversed earnings; same definition the scanner uses), the
  // tier that lands them in, and how far the next one is. Only when this
  // check-in actually earned points.
  let tierInfo: {
    lifetime_points: number;
    tier: { name: string; color: string };
    tier_up: { from: string; to: string; color: string } | null;
    next_tier: { name: string; color: string; points_needed: number; progress: number } | null;
  } | null = null;
  if (pointsAwarded > 0) {
    const [{ data: allAmounts }, tiers] = await Promise.all([
      supabase.from('point_transactions').select('amount, reversed_at').eq('user_id', user.id),
      fetchTiers(supabase),
    ]);
    if (tiers.length > 0) {
      const lifetime = (allAmounts ?? []).filter((t) => t.amount > 0 && !t.reversed_at).reduce((sum, t) => sum + t.amount, 0);
      const current = getTier(lifetime, tiers);
      const next = nextTier(lifetime, tiers);
      // Did *this* check-in's points carry them over a tier line? Compare
      // where they'd be without it. (The referral bonus, if any, goes to
      // someone else's ledger, so this check-in only moves this member's
      // own total by pointsAwarded.)
      const before = getTier(lifetime - pointsAwarded, tiers);
      tierInfo = {
        tier_up: before.name !== current.name ? { from: before.name, to: current.name, color: current.color } : null,
        lifetime_points: lifetime,
        tier: { name: current.name, color: current.color },
        next_tier: next
          ? {
              name: next.name,
              color: next.color,
              points_needed: next.min - lifetime,
              progress: Math.max(0, Math.min(1, (lifetime - current.min) / (next.min - current.min))),
            }
          : null,
      };
    }
  }

  const dayInfo = multiDay && event ? currentDayInfo(event.start_date, event.end_date) : null;

  return NextResponse.json({
    checked_in_today: checkedInToday,
    day_number: dayInfo?.day ?? null,
    day_total: dayInfo?.total ?? null,
    points_awarded: pointsAwarded,
    tier_info: tierInfo,
    status: ticket.status,
    checked_in_at: todayAt ?? ticket.checked_in_at,
    checkin_form_url: checkinFormUrl,
    checkin_form_completed_at: ticket.checkin_form_completed_at,
  });
}
