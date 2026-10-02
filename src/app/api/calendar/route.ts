import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { pacificDayKey } from '@/lib/checkinDays';
import { isExpected } from '@/lib/meetingAudience';
import { addDaysKey, loadGroups, occurrenceTimes, weekdayOfKey, withExtras, type MeetingRow, type SeriesRow } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

export interface CalendarItem {
  key: string;
  kind: 'event' | 'meeting';
  date: string;            // the Pacific day this entry sits on
  title: string;
  start: string; end: string | null;   // ISO
  location: string | null;
  href: string;
  mine: boolean;           // I have a ticket / I'm hosting
  dayLabel: string | null; // "Day 2 of 3" for multi-day events
  repeats?: boolean;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Everything with a date that matters to this person, for a date range: published events (plus whether
// they have a ticket) and the meetings meant for them. Exec/admin see only the meetings they're invited
// to or planned, same as everyone: being able to run any meeting doesn't mean attending it.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const today = pacificDayKey();
  const from = DATE.test(url.searchParams.get('from') ?? '') ? url.searchParams.get('from')! : addDaysKey(today, -7);
  let to = DATE.test(url.searchParams.get('to') ?? '') ? url.searchParams.get('to')! : addDaysKey(from, 42);
  if (to < from) return NextResponse.json({ error: 'Bad range.' }, { status: 400 });
  if (to > addDaysKey(from, 62)) to = addDaysKey(from, 62);

  const svc = createServiceClient();
  const { data: roleRows } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const roles = roleRows ?? [];
  const canManageAll = hasCapability(roles, 'manage_meetings');

  const startIso = new Date(`${addDaysKey(from, -1)}T00:00:00Z`).toISOString();
  const endIso = new Date(`${addDaysKey(to, 2)}T00:00:00Z`).toISOString();
  const [{ data: events }, { data: tickets }, groups, { data: seriesData }, { data: rowData }] = await Promise.all([
    supabase.from('events').select('id, slug, title, location, start_date, end_date').eq('is_published', true).lte('start_date', endIso).order('start_date'),
    supabase.from('tickets').select('event_id').eq('user_id', user.id),
    loadGroups(svc),
    svc.from('meeting_series').select('id, title, weekday, start_time, end_time, location, active, doc_url, audience, invitees, group_ids, description, created_by, created_at').eq('active', true),
    svc.from('meetings').select('*').gte('meeting_date', from).lte('meeting_date', to).eq('cancelled', false),
  ]);

  const items: CalendarItem[] = [];
  const ticketed = new Set((tickets ?? []).map((t) => t.event_id as string));
  for (const e of events ?? []) {
    const endsAt = (e.end_date as string | null) ?? (e.start_date as string);
    if (endsAt < startIso) continue;
    const first = pacificDayKey(new Date(e.start_date as string));
    const last = pacificDayKey(new Date(endsAt));
    const span = Math.max(1, Math.round((new Date(`${last}T12:00:00Z`).getTime() - new Date(`${first}T12:00:00Z`).getTime()) / 86_400_000) + 1);
    for (let i = 0; i < span; i++) {
      const day = addDaysKey(first, i);
      if (day < from || day > to) continue;
      items.push({ key: `e|${e.id}|${day}`, kind: 'event', date: day, title: e.title as string, start: e.start_date as string, end: (e.end_date as string | null) ?? null, location: e.location as string | null, href: e.slug ? `/events/${e.slug}` : '/events', mine: ticketed.has(e.id as string), dayLabel: span > 1 ? `Day ${i + 1} of ${span}` : null });
    }
  }

  const rows = (rowData ?? []) as MeetingRow[];
  const mineOrManage = (m: { audience: string[] | null; invitees: string[] | null; group_ids: string[] | null; created_by: string | null }) => {
    const [x] = withExtras([m], groups);
    return m.created_by === user.id || isExpected({ audience: m.audience, extra_ids: x.extra_ids }, user.id, roles);
  };
  const meetingHref = (createdBy: string | null) => (canManageAll || createdBy === user.id ? '/portal?section=meetings&tab=run' : '/portal?section=meetings');
  for (const r of rows) {
    if (!mineOrManage(r)) continue;
    items.push({ key: `m|${r.id}`, kind: 'meeting', date: r.meeting_date, title: r.title, start: r.starts_at, end: r.ends_at, location: r.location, href: meetingHref(r.created_by), mine: r.created_by === user.id, dayLabel: null, repeats: !!r.series_id });
  }
  const taken = new Set(rows.filter((r) => r.series_id).map((r) => `${r.series_id}|${r.meeting_date}`));
  // Occurrences of repeating meetings that nobody has opened yet (no row exists), never before the series began.
  const horizon = addDaysKey(today, 180);
  for (const s of (seriesData ?? []) as (SeriesRow & { created_at: string })[]) {
    if (!mineOrManage(s)) continue;
    const began = pacificDayKey(new Date(s.created_at));
    for (let day = from; day <= to && day <= horizon; day = addDaysKey(day, 1)) {
      if (day < began || weekdayOfKey(day) !== s.weekday || taken.has(`${s.id}|${day}`)) continue;
      const { starts, ends } = occurrenceTimes(day, s.start_time, s.end_time);
      items.push({ key: `s|${s.id}|${day}`, kind: 'meeting', date: day, title: s.title, start: starts.toISOString(), end: ends.toISOString(), location: s.location, href: meetingHref(s.created_by), mine: s.created_by === user.id, dayLabel: null, repeats: true });
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return NextResponse.json({ from, to, today, items });
}
