import type { SupabaseClient } from '@supabase/supabase-js';
import { pacificDayKey } from '@/lib/checkinDays';
import { createNotifications } from '@/lib/notify';
import { loadMyShifts } from '@/lib/myShifts';

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
