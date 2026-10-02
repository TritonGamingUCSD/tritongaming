import type { SupabaseClient } from '@supabase/supabase-js';
import { pacificDayKey } from '@/lib/checkinDays';
import { createNotifications } from '@/lib/notify';
import { getExpectedPeople, occurrenceTimes, weekdayOfKey, type MeetingRow, type SeriesRow } from '@/lib/meetings';

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' });

interface Item {
  key: string; kind: 'meeting' | 'internal'; title: string; starts_at: string; location: string | null;
  audience: string[] | null; invitees: string[] | null; group_ids: string[] | null; href: string;
  skip: Set<string>;   // people who shouldn't get it (excused from the meeting, said they can't go)
}

// "Today at 5:00 PM" reminders for the meetings and internal events happening today that haven't started yet, sent to
// the people they're for. Safe to run as often as you like: reminders_sent remembers who already got which one.
// (Run it once a morning; run it every 15 minutes with `withinMinutes` set to get "starting soon" reminders instead.)
export async function sendMeetingReminders(svc: SupabaseClient, now: Date = new Date(), withinMinutes?: number, onlyUsers?: string[]): Promise<{ items: number; sent: number }> {
  const today = pacificDayKey(now);
  const until = withinMinutes ? now.getTime() + withinMinutes * 60_000 : Infinity;
  const [{ data: seriesData }, { data: meetingRows }, { data: internalRows }] = await Promise.all([
    svc.from('meeting_series').select('id, title, weekday, start_time, end_time, location, active, doc_url, audience, invitees, group_ids, description, created_by, created_at').eq('active', true),
    svc.from('meetings').select('*').eq('meeting_date', today).eq('cancelled', false),
    svc.from('internal_events').select('*').eq('event_date', today).eq('cancelled', false),
  ]);
  const items: Item[] = [];
  const rows = (meetingRows ?? []) as MeetingRow[];
  const { data: absences } = rows.length ? await svc.from('meeting_absences').select('meeting_id, user_id, excused').in('meeting_id', rows.map((r) => r.id)).eq('excused', true) : { data: [] as { meeting_id: string; user_id: string }[] };
  for (const r of rows) {
    items.push({ key: `meeting:${r.id}`, kind: 'meeting', title: r.title, starts_at: r.starts_at, location: r.location, audience: r.audience, invitees: r.invitees, group_ids: r.group_ids, href: '/portal?section=meetings&tab=checkin', skip: new Set((absences ?? []).filter((a) => a.meeting_id === r.id).map((a) => a.user_id as string)) });
  }
  const taken = new Set(rows.filter((r) => r.series_id).map((r) => r.series_id as string));
  for (const s of (seriesData ?? []) as (SeriesRow & { created_at: string })[]) {
    // A repeating meeting with no row for today yet (nobody has opened it): its occurrence is virtual.
    if (taken.has(s.id) || weekdayOfKey(today) !== s.weekday || today < pacificDayKey(new Date(s.created_at))) continue;
    const { starts } = occurrenceTimes(today, s.start_time, s.end_time);
    items.push({ key: `series:${s.id}|${today}`, kind: 'meeting', title: s.title, starts_at: starts.toISOString(), location: s.location, audience: s.audience, invitees: s.invitees, group_ids: s.group_ids, href: '/portal?section=meetings&tab=checkin', skip: new Set() });
  }
  const internal = (internalRows ?? []) as { id: string; title: string; starts_at: string; location: string | null; audience: string[] | null; invitees: string[] | null; group_ids: string[] | null }[];
  const { data: no } = internal.length ? await svc.from('internal_event_rsvps').select('event_id, user_id').in('event_id', internal.map((e) => e.id)).eq('status', 'not_going') : { data: [] as { event_id: string; user_id: string }[] };
  for (const e of internal) {
    items.push({ key: `internal:${e.id}`, kind: 'internal', title: e.title, starts_at: e.starts_at, location: e.location, audience: e.audience, invitees: e.invitees, group_ids: e.group_ids, href: '/portal?section=internal-events', skip: new Set((no ?? []).filter((n) => n.event_id === e.id).map((n) => n.user_id as string)) });
  }

  let sent = 0, counted = 0;
  for (const it of items) {
    const t = new Date(it.starts_at).getTime();
    if (t <= now.getTime() || t > until) continue;
    counted++;
    const people = (await getExpectedPeople(svc, { audience: it.audience, invitees: it.invitees, group_ids: it.group_ids })).filter((p) => !it.skip.has(p.id) && (!onlyUsers || onlyUsers.includes(p.id)));
    if (people.length === 0) continue;
    // Only people who haven't been reminded about this one yet (the insert reports just the new rows).
    const { data: fresh } = await svc.from('reminders_sent').upsert(people.map((p) => ({ item_key: it.key, user_id: p.id })), { onConflict: 'item_key,user_id', ignoreDuplicates: true }).select('user_id');
    const ids = (fresh ?? []).map((f) => f.user_id as string);
    if (ids.length === 0) continue;
    sent += await createNotifications(svc, ids.map((user_id) => ({
      user_id,
      type: it.kind === 'meeting' ? 'meeting_reminder' : 'internal_event_reminder',
      title: `${it.title} is today at ${clock(it.starts_at)}`,
      body: it.location ? `Where: ${it.location}` : null,
      href: it.href,
    })));
  }
  return { items: counted, sent };
}
