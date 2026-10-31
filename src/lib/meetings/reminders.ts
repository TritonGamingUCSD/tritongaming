import { formatPacificTime, pacificDayKey } from '@/lib/core/timezone';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createNotifications } from '@/lib/notifications/notify';
import { getExpectedPeople, occurrenceTimes, seriesRunsOn, type MeetingRow, type SeriesRow } from '@/lib/meetings/meetings';

const clock = (iso: string) => formatPacificTime(iso);

export interface Item {
  key: string;
  kind: 'meeting';
  title: string;
  starts_at: string;
  location: string | null;
  audience: string[] | null;
  invitees: string[] | null;
  group_ids: string[] | null;
  href: string;
  skip: Set<string>; // people who shouldn't get it (excused from the meeting, said they can't go)
}

// The meetings to remind about on this day: the day's real meetings plus the occurrences of repeating series nobody has opened yet (virtual ones), each with the people to leave out.
async function loadItems(svc: SupabaseClient, today: string): Promise<Item[]> {
  const [{ data: seriesData }, { data: meetingRows }] = await Promise.all([
    svc
      .from('meeting_series')
      .select('id, title, weekday, start_time, end_time, location, active, doc_url, audience, invitees, group_ids, created_by, created_at, ends_on')
      .eq('active', true),
    svc.from('meetings').select('*').eq('meeting_date', today).eq('cancelled', false),
  ]);
  const items: Item[] = [];
  const rows = (meetingRows ?? []) as MeetingRow[];
  const { data: absences } = rows.length
    ? await svc
        .from('meeting_absences')
        .select('meeting_id, user_id, excused')
        .in(
          'meeting_id',
          rows.map((r) => r.id),
        )
        .eq('excused', true)
    : { data: [] as { meeting_id: string; user_id: string }[] };
  for (const r of rows) {
    items.push({
      key: `meeting:${r.id}`,
      kind: 'meeting',
      title: r.title,
      starts_at: r.starts_at,
      location: r.location,
      audience: r.audience,
      invitees: r.invitees,
      group_ids: r.group_ids,
      href: '/portal/meetings/mine',
      skip: new Set((absences ?? []).filter((a) => a.meeting_id === r.id).map((a) => a.user_id as string)),
    });
  }
  const taken = new Set(rows.filter((r) => r.series_id).map((r) => r.series_id as string));
  const { data: standing } = await svc.from('meeting_series_absences').select('series_id, user_id').eq('excused', true);
  for (const s of (seriesData ?? []) as (SeriesRow & { created_at: string })[]) {
    // A repeating meeting with no row for today yet (nobody has opened it): its occurrence is virtual.
    if (taken.has(s.id) || !seriesRunsOn(s, today) || today < pacificDayKey(new Date(s.created_at))) continue;
    const { starts } = occurrenceTimes(today, s.start_time, s.end_time);
    items.push({
      key: `series:${s.id}|${today}`,
      kind: 'meeting',
      title: s.title,
      starts_at: starts.toISOString(),
      location: s.location,
      audience: s.audience,
      invitees: s.invitees,
      group_ids: s.group_ids,
      href: '/portal/meetings/mine',
      skip: new Set((standing ?? []).filter((a) => a.series_id === s.id).map((a) => a.user_id as string)),
    });
  }
  return items;
}

// The ones still to come, and (with a limit) starting no later than it. Pure.
export function upcomingItems(items: Item[], now: Date, withinMinutes?: number): Item[] {
  const until = withinMinutes ? now.getTime() + withinMinutes * 60_000 : Infinity;
  return items.filter((it) => {
    const t = new Date(it.starts_at).getTime();
    return t > now.getTime() && t <= until;
  });
}

// What the reminder says. Pure.
export function reminderText(it: Pick<Item, 'title' | 'starts_at' | 'location'>): { title: string; body: string | null } {
  return { title: `${it.title} is today at ${clock(it.starts_at)}`, body: it.location ? `Where: ${it.location}` : null };
}

// Reminds the people a meeting is for (leaving out the excused and, in a test, everyone but `onlyUsers`), once each: the insert reports only the rows that were new.
async function remindPeople(svc: SupabaseClient, it: Item, onlyUsers?: string[]): Promise<number> {
  const people = (await getExpectedPeople(svc, { audience: it.audience, invitees: it.invitees, group_ids: it.group_ids })).filter(
    (p) => !it.skip.has(p.id) && (!onlyUsers || onlyUsers.includes(p.id)),
  );
  if (people.length === 0) return 0;
  const { data: fresh } = await svc
    .from('reminders_sent')
    .upsert(
      people.map((p) => ({ item_key: it.key, user_id: p.id })),
      { onConflict: 'item_key,user_id', ignoreDuplicates: true },
    )
    .select('user_id');
  const text = reminderText(it);
  return createNotifications(
    svc,
    (fresh ?? []).map((f) => ({ user_id: f.user_id as string, type: 'meeting_reminder', ...text, href: it.href })),
  );
}

// "Today at 5:00 PM" reminders for the meetings happening today that haven't started yet, sent to
// the people they're for. Safe to run as often as you like: reminders_sent remembers who already got which one.
// (Run it once a morning; run it every 15 minutes with `withinMinutes` set to get "starting soon" reminders instead.)
export async function sendMeetingReminders(svc: SupabaseClient, now: Date = new Date(), withinMinutes?: number, onlyUsers?: string[]): Promise<{ items: number; sent: number }> {
  const items = upcomingItems(await loadItems(svc, pacificDayKey(now)), now, withinMinutes);
  let sent = 0;
  for (const it of items) sent += await remindPeople(svc, it, onlyUsers);
  return { items: items.length, sent };
}
