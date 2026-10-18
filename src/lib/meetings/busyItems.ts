import type { SupabaseClient } from '@supabase/supabase-js';
import { hasCapability, isTgMember, type RoleGrant } from '@/lib/portal/capabilities';
import { pacificDayKey } from '@/lib/events/checkinDays';
import { isExpected } from '@/lib/meetings/meetingAudience';
import { addDaysKey, loadGroups, occurrenceTimes, seriesRunsOn, withExtras, type MeetingRow, type SeriesRow } from '@/lib/meetings/meetings';

// What is already on a person's own schedule between two Pacific days (inclusive): the events they have a ticket for and the meetings meant
// for them or hosted by them (including repeating ones nobody has opened yet). The planning grid uses it to mark times they cannot make, and the
// portal search uses it to list meetings.
export interface BusyItem {
  kind: 'event' | 'meeting';
  date: string;            // the Pacific day this entry sits on
  title: string;
  start: string; end: string | null;   // ISO
  mine: boolean;           // they have a ticket / are hosting
  repeats?: boolean;
  /** Meetings only (portal search lists them): a stable key, where it is and the page to open. */
  key?: string; location?: string | null; href?: string;
}

export async function collectBusyItems(svc: SupabaseClient, user: { id: string }, roles: RoleGrant[], from: string, to: string): Promise<BusyItem[]> {
  const today = pacificDayKey();
  const startIso = new Date(`${addDaysKey(from, -1)}T00:00:00Z`).toISOString();
  const endIso = new Date(`${addDaysKey(to, 2)}T00:00:00Z`).toISOString();
  const [{ data: events }, { data: tickets }, groups, { data: seriesData }, { data: rowData }] = await Promise.all([
    svc.from('events').select('id, title, start_date, end_date').eq('is_published', true).lte('start_date', endIso).order('start_date'),
    svc.from('tickets').select('event_id').eq('user_id', user.id),
    loadGroups(svc),
    svc.from('meeting_series').select('id, title, weekday, start_time, end_time, location, active, doc_url, audience, invitees, group_ids, created_by, created_at, ends_on').eq('active', true),
    svc.from('meetings').select('*').gte('meeting_date', from).lte('meeting_date', to).eq('cancelled', false),
  ]);

  const items: BusyItem[] = [];
  const canManageAll = hasCapability(roles, 'manage_meetings');
  const meetingHref = (createdBy: string | null) => (canManageAll || createdBy === user.id ? '/portal/meetings/host' : '/portal/meetings');
  const ticketed = new Set((tickets ?? []).map((t) => t.event_id as string));
  for (const e of events ?? []) {
    if (!ticketed.has(e.id as string)) continue;
    const endsAt = (e.end_date as string | null) ?? (e.start_date as string);
    if (endsAt < startIso) continue;
    const first = pacificDayKey(new Date(e.start_date as string));
    const last = pacificDayKey(new Date(endsAt));
    const span = Math.max(1, Math.round((new Date(`${last}T12:00:00Z`).getTime() - new Date(`${first}T12:00:00Z`).getTime()) / 86_400_000) + 1);
    for (let i = 0; i < span; i++) {
      const day = addDaysKey(first, i);
      if (day < from || day > to) continue;
      items.push({ kind: 'event', date: day, title: e.title as string, start: e.start_date as string, end: (e.end_date as string | null) ?? null, mine: true });
    }
  }

  // Anyone who is not on the TG team has no meetings.
  if (!isTgMember(roles)) return items;

  const mineOrHosted = (m: { audience: string[] | null; invitees: string[] | null; group_ids: string[] | null; created_by: string | null }) => {
    const [x] = withExtras([m], groups);
    return m.created_by === user.id || isExpected({ audience: m.audience, invitees: m.invitees, group_ids: m.group_ids, extra_ids: x.extra_ids }, user.id, roles);
  };
  const rows = (rowData ?? []) as MeetingRow[];
  for (const r of rows) {
    if (!mineOrHosted(r)) continue;
    items.push({ kind: 'meeting', key: `m|${r.id}`, date: r.meeting_date, title: r.title, start: r.starts_at, end: r.ends_at, location: r.location, href: meetingHref(r.created_by), mine: r.created_by === user.id, repeats: !!r.series_id });
  }
  const taken = new Set(rows.filter((r) => r.series_id).map((r) => `${r.series_id}|${r.meeting_date}`));
  // Occurrences of repeating meetings that nobody has opened yet (no row exists), never before the series began.
  const horizon = addDaysKey(today, 180);
  for (const s of (seriesData ?? []) as (SeriesRow & { created_at: string })[]) {
    if (!mineOrHosted(s)) continue;
    const began = pacificDayKey(new Date(s.created_at));
    for (let day = from; day <= to && day <= horizon; day = addDaysKey(day, 1)) {
      if (day < today || day < began || !seriesRunsOn(s, day) || taken.has(`${s.id}|${day}`)) continue;
      const { starts, ends } = occurrenceTimes(day, s.start_time, s.end_time);
      items.push({ kind: 'meeting', key: `s|${s.id}|${day}`, date: day, title: s.title, start: starts.toISOString(), end: ends.toISOString(), location: s.location, href: meetingHref(s.created_by), mine: s.created_by === user.id, repeats: true });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return items;
}
