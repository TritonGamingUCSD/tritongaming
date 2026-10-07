import type { SupabaseClient } from '@supabase/supabase-js';
import { hasCapability, isTgMember, type RoleGrant } from '@/lib/portal/capabilities';
import { pacificDayKey } from '@/lib/events/checkinDays';
import { audienceLabel, isExpected } from '@/lib/meetings/meetingAudience';
import { loadMyShifts } from '@/lib/shifts/myShifts';
import { addDaysKey, loadGroups, occurrenceTimes, seriesRunsOn, withExtras, type MeetingRow, type SeriesRow } from '@/lib/meetings/meetings';

export interface CalendarItem {
  key: string;
  kind: 'event' | 'meeting' | 'internal' | 'google' | 'shift';
  date: string;            // the Pacific day this entry sits on
  title: string;
  start: string; end: string | null;   // ISO
  location: string | null;
  href: string;
  mine: boolean;           // I have a ticket / I'm hosting
  /** My own standing, for the badge: a ticket, checked in, hosting, going or maybe (internal event RSVP). */
  status?: 'ticket' | 'checked_in' | 'hosting' | 'going' | 'maybe';
  description?: string | null;
  allDay?: boolean;
  /** For a linked Google Calendar item: which Google account it came from. */
  account?: string;
  dayLabel: string | null; // "Day 2 of 3" for multi-day events
  repeats?: boolean;
  /** A meeting that is not mine, shown in the "All TG meetings" view: title, time and who it is for, nothing else. Not a link. */
  others?: boolean;
  audience?: string;
}


// Everything with a date that matters to this person, for a date range (Pacific day keys, inclusive): published
// events (plus whether they have a ticket), the meetings meant for them, and every internal event (open to all TG members).
// Exec/admin see only the meetings they're invited to or planned, same as everyone: being able to run any meeting
// doesn't mean attending it. Uses the service client only, so it also works for the signed-out calendar feed.
export async function collectCalendarItems(svc: SupabaseClient, user: { id: string }, roles: RoleGrant[], from: string, to: string, opts: { everyone?: boolean } = {}): Promise<CalendarItem[]> {
  const today = pacificDayKey();
  const canManageAll = hasCapability(roles, 'manage_meetings');
  const startIso = new Date(`${addDaysKey(from, -1)}T00:00:00Z`).toISOString();
  const endIso = new Date(`${addDaysKey(to, 2)}T00:00:00Z`).toISOString();
  const [{ data: events }, { data: tickets }, groups, { data: seriesData }, { data: rowData }] = await Promise.all([
    svc.from('events').select('id, slug, title, location, start_date, end_date').eq('is_published', true).lte('start_date', endIso).order('start_date'),
    svc.from('tickets').select('event_id, checked_in_at').eq('user_id', user.id),
    loadGroups(svc),
    svc.from('meeting_series').select('id, title, weekday, start_time, end_time, location, active, doc_url, audience, invitees, group_ids, description, created_by, created_at, ends_on, is_private').eq('active', true),
    svc.from('meetings').select('*').gte('meeting_date', from).lte('meeting_date', to).eq('cancelled', false),
  ]);

  const items: CalendarItem[] = [];
  const ticketed = new Set((tickets ?? []).map((t) => t.event_id as string));
  const checkedIn = new Set((tickets ?? []).filter((t) => t.checked_in_at).map((t) => t.event_id as string));
  for (const e of events ?? []) {
    const endsAt = (e.end_date as string | null) ?? (e.start_date as string);
    if (endsAt < startIso) continue;
    const first = pacificDayKey(new Date(e.start_date as string));
    const last = pacificDayKey(new Date(endsAt));
    const span = Math.max(1, Math.round((new Date(`${last}T12:00:00Z`).getTime() - new Date(`${first}T12:00:00Z`).getTime()) / 86_400_000) + 1);
    for (let i = 0; i < span; i++) {
      const day = addDaysKey(first, i);
      if (day < from || day > to) continue;
      items.push({ key: `e|${e.id}|${day}`, kind: 'event', date: day, title: e.title as string, start: e.start_date as string, end: (e.end_date as string | null) ?? null, location: e.location as string | null, href: e.slug ? `/events/${e.slug}` : '/events', mine: ticketed.has(e.id as string), status: checkedIn.has(e.id as string) ? 'checked_in' : ticketed.has(e.id as string) ? 'ticket' : undefined, dayLabel: span > 1 ? `Day ${i + 1} of ${span}` : null });
    }
  }

  // Anyone who is not on the TG team (a UCSD student with just the student badge) sees the events and nothing else.
  if (!isTgMember(roles)) { items.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)); return items; }

  const rows = (rowData ?? []) as MeetingRow[];
  const mineOrManage = (m: { audience: string[] | null; invitees: string[] | null; group_ids: string[] | null; created_by: string | null }) => {
    const [x] = withExtras([m], groups);
    return m.created_by === user.id || isExpected({ audience: m.audience, invitees: m.invitees, group_ids: m.group_ids, extra_ids: x.extra_ids }, user.id, roles);
  };
  const meetingHref = (createdBy: string | null) => (canManageAll || createdBy === user.id ? '/portal/meetings/host' : '/portal/meetings');
  // "All TG meetings": everyone else's meetings too, except the ones a host marked private. Only the bare facts leave here.
  const othersItem = (m: { audience: string[] | null; invitees: string[] | null; group_ids: string[] | null }) => {
    const [x] = withExtras([m], groups);
    return { others: true, location: null, audience: audienceLabel({ audience: m.audience, invitees: m.invitees, group_ids: m.group_ids, groupNames: (m.group_ids ?? []).map((g) => groups.get(g)?.name).filter((n): n is string => !!n), extra_ids: x.extra_ids }) };
  };
  for (const r of rows) {
    const mine = mineOrManage(r);
    if (!mine && !(opts.everyone && !r.is_private)) continue;
    if (!mine) { items.push({ key: `m|${r.id}`, kind: 'meeting', date: r.meeting_date, title: r.title, start: r.starts_at, end: r.ends_at, href: '/portal/calendar', mine: false, dayLabel: null, repeats: !!r.series_id, ...othersItem(r) }); continue; }
    items.push({ key: `m|${r.id}`, kind: 'meeting', date: r.meeting_date, title: r.title, start: r.starts_at, end: r.ends_at, location: r.location, href: meetingHref(r.created_by), mine: r.created_by === user.id, status: r.created_by === user.id ? 'hosting' : undefined, dayLabel: null, repeats: !!r.series_id });
  }
  const taken = new Set(rows.filter((r) => r.series_id).map((r) => `${r.series_id}|${r.meeting_date}`));
  // Occurrences of repeating meetings that nobody has opened yet (no row exists), never before the series began.
  const horizon = addDaysKey(today, 180);
  for (const s of (seriesData ?? []) as (SeriesRow & { created_at: string })[]) {
    const mine = mineOrManage(s);
    if (!mine && !(opts.everyone && !s.is_private)) continue;
    const began = pacificDayKey(new Date(s.created_at));
    for (let day = from; day <= to && day <= horizon; day = addDaysKey(day, 1)) {
      // A week that has gone by with no meeting opened or kept never happened: deleting a held meeting must not bring it back as "scheduled".
      if (day < today || day < began || !seriesRunsOn(s, day) || taken.has(`${s.id}|${day}`)) continue;
      const { starts, ends } = occurrenceTimes(day, s.start_time, s.end_time);
      if (!mine) { items.push({ key: `s|${s.id}|${day}`, kind: 'meeting', date: day, title: s.title, start: starts.toISOString(), end: ends.toISOString(), href: '/portal/calendar', mine: false, dayLabel: null, repeats: true, ...othersItem(s) }); continue; }
      items.push({ key: `s|${s.id}|${day}`, kind: 'meeting', date: day, title: s.title, start: starts.toISOString(), end: ends.toISOString(), location: s.location, href: meetingHref(s.created_by), mine: s.created_by === user.id, status: s.created_by === user.id ? 'hosting' : undefined, dayLabel: null, repeats: true });
    }
  }
  // Internal events: all of them, for any TG member. Their own kind: they never count as meetings.
  const { data: internalRows } = await svc.from('internal_events').select('*').gte('event_date', from).lte('event_date', to).eq('cancelled', false);
  const { data: myRsvps } = await svc.from('internal_event_rsvps').select('event_id, status').eq('user_id', user.id);
  const going = new Set((myRsvps ?? []).filter((r) => r.status === 'going').map((r) => r.event_id as string));
  const maybe = new Set((myRsvps ?? []).filter((r) => r.status === 'maybe').map((r) => r.event_id as string));
  // An internal event stays on my calendar (going, maybe or not answered yet) until I say I can't go.
  const declined = new Set((myRsvps ?? []).filter((r) => r.status === 'not_going').map((r) => r.event_id as string));
  for (const r of internalRows ?? []) {
    // Internal events are open to every TG member (exec, leads, officers, recruits, alumni), whoever they were aimed at.
    if (!isTgMember(roles)) break;
    if (declined.has(r.id as string)) continue;
    items.push({ key: `x|${r.id}`, kind: 'internal', date: r.event_date as string, title: r.title as string, start: r.starts_at as string, end: r.ends_at as string, location: r.location as string | null, href: '/portal/internal-events', mine: going.has(r.id as string), status: going.has(r.id as string) ? 'going' : maybe.has(r.id as string) ? 'maybe' : undefined, dayLabel: null });
  }
  // My own shifts (one block per station, back-to-back slots joined): only ever the signed-in person's, never anyone else's.
  for (const sh of await loadMyShifts(svc, user.id, new Date(startIso).getTime(), new Date(endIso).getTime()).catch(() => [])) {
    const day = pacificDayKey(new Date(sh.start));
    if (day < from || day > to) continue;
    items.push({
      key: `s|${sh.eventId}|${sh.stationId}|${sh.start}`, kind: 'shift', date: day, title: `Shift: ${sh.stationName}`, start: sh.start, end: sh.end, location: sh.location,
      href: `/portal/shifts?event=${sh.eventId}&guide=${sh.stationId}`, mine: true,
      description: `${sh.eventTitle}${sh.category === 'team' ? ` (${sh.teamLabel || 'team'} shift)` : ''}. Where to be and what to do is in the station guide.`, dayLabel: null,
    });
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return items;
}
