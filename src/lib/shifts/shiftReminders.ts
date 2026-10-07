import type { SupabaseClient } from '@supabase/supabase-js';
import { pacificDayKey } from '@/lib/events/checkinDays';
import { createNotifications } from '@/lib/notifications/notify';
import { loadMyShifts } from '@/lib/shifts/myShifts';
import { slotRange, type ShiftPlan } from '@/lib/shifts/shifts';
import { coverAlertDue } from '@/lib/shifts/shiftFields';

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' });

// "You're on Check-in at 2:00 PM today": the morning of the event, a bell (and push) reminder to everyone with a shift that day. One reminder per person per
// event day (reminders_sent remembers), so it is safe to run as often as you like.
export async function sendShiftReminders(svc: SupabaseClient, now: Date = new Date(), onlyUsers?: string[]): Promise<{ people: number; sent: number }> {
  const today = pacificDayKey(now);
  const { data: rows } = await svc.from('shift_signups').select('user_id');
  const everyone = [...new Set((rows ?? []).map((r) => r.user_id as string))].filter((id) => !onlyUsers || onlyUsers.includes(id));
  let people = 0, sent = 0;
  for (const userId of everyone) {
    // Shifts that still lie ahead today (Pacific day).
    const mine = (await loadMyShifts(svc, userId, now.getTime(), now.getTime() + 36 * 3600_000)).filter((s) => pacificDayKey(new Date(s.start)) === today && new Date(s.start).getTime() > now.getTime());
    if (mine.length === 0) continue;
    people++;
    const first = mine[0];
    const key = `shift:${first.eventId}|${today}`;
    const { data: fresh } = await svc.from('reminders_sent').upsert([{ item_key: key, user_id: userId }], { onConflict: 'item_key,user_id', ignoreDuplicates: true }).select('user_id');
    if (!fresh?.length) continue;
    const more = mine.length > 1 ? ` (+${mine.length - 1} more)` : '';
    sent += await createNotifications(svc, [{
      user_id: userId, type: 'shift_reminder',
      title: `You're on ${first.stationName} at ${clock(first.start)} today${more}`,
      body: `${first.eventTitle}${first.location ? ` · ${first.location}` : ''}. Open the station guide before you go.`,
      href: '/portal/shifts',
    }]);
  }
  return { people, sent };
}

// Cover requests nobody has taken: exec gets one bell 3 hours after the request, and one more within 2 hours of the shift. A daily job can't be that
// exact, so this also runs whenever someone opens the shifts grid (see api/shifts/[eventId]); each alert is stamped so it is only ever sent once.
export async function alertStaleCovers(svc: SupabaseClient, now: Date = new Date()): Promise<number> {
  const { data: open } = await svc.from('shift_cover_requests').select('id, event_id, station_id, slot_index, requester_id, created_at, alerted_at, alerted_final_at').eq('status', 'open');
  if (!open?.length) return 0;
  const eventIds = [...new Set(open.map((o) => o.event_id as string))];
  const [{ data: plans }, { data: events }, { data: stations }, { data: execRows }] = await Promise.all([
    svc.from('event_shifts').select('event_id, starts_at, ends_at, slot_minutes').in('event_id', eventIds),
    svc.from('events').select('id, title').in('id', eventIds),
    svc.from('shift_stations').select('id, name').in('id', [...new Set(open.map((o) => o.station_id as string))]),
    svc.from('user_roles').select('user_id').in('role', ['exec', 'admin']),
  ]);
  const plan = new Map((plans ?? []).map((p) => [p.event_id as string, p as unknown as ShiftPlan]));
  const title = new Map((events ?? []).map((e) => [e.id as string, e.title as string]));
  const station = new Map((stations ?? []).map((s) => [s.id as string, s.name as string]));
  const execs = [...new Set((execRows ?? []).map((r) => r.user_id as string))];
  let sent = 0;
  for (const o of open) {
    const p = plan.get(o.event_id as string);
    if (!p) continue;
    const start = slotRange(p, o.slot_index as number).start;
    if (start.getTime() <= now.getTime()) continue;
    const due = coverAlertDue({ createdAt: new Date(o.created_at as string), start, now, alerted: !!o.alerted_at, alertedFinal: !!o.alerted_final_at });
    if (!due) continue;
    const final = due === 'final';
    // Claim first so two openers of the grid can't both send it.
    const stamp = now.toISOString();
    const patch = final ? { alerted_at: stamp, alerted_final_at: stamp } : { alerted_at: stamp };
    const { data: claimed } = await svc.from('shift_cover_requests').update(patch).eq('id', o.id as string).is(final ? 'alerted_final_at' : 'alerted_at', null).select('id');
    if (!claimed?.length) continue;
    const st = station.get(o.station_id as string) ?? 'a station';
    sent += await createNotifications(svc, execs.filter((id) => id !== o.requester_id).map((user_id) => ({
      user_id, type: 'shift_cover', title: `Still needs cover: ${st} at ${clock(start.toISOString())}`,
      body: `${title.get(o.event_id as string) ?? 'An event'}. Nobody has taken it${final ? ' and the shift is within 2 hours' : ' yet'}.`, href: `/portal/shifts?event=${o.event_id}`,
    })));
  }
  return sent;
}
