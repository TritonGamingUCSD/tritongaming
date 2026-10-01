import { createServiceClient } from '@/lib/supabase/admin';
import { PACIFIC_TZ, eventDayCount, pacificDaysUntil } from '@/lib/timezone';
import { parseMajors } from '@/lib/majors';
import { parseGames } from '@/lib/games';

export interface Bucket { label: string; count: number }

export interface EventSummary {
  registered: number;
  checkedIn: number;
  noShows: number;
  attendanceRate: number;
  cancelled: number;
  firstTime: number;
  returning: number;
  formOpened: number | null; // null when the event has no AS Form
  pointsAwarded: number;
  arrivals: Bucket[];
  gender: Bucket[];
  year: Bucket[];
  college: Bucket[];
  major: Bucket[];
  field: Bucket[];
  doubleMajors: number;
  pronouns: Bucket[];
  platforms: Bucket[];
  games: Bucket[];
  divisions: Bucket[];
  claimTiming: Bucket[];
  sources: Bucket[];
  allDays: number | null; // multi-day events: attendees scanned in on every day
  feedback: { count: number; average: number | null; comments: string[] };
}

function tally(values: (string | null | undefined)[], opts: { top?: number; blank?: string } = {}): Bucket[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v?.trim() || opts.blank || 'Not provided';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const all = [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  if (opts.top && all.length > opts.top) {
    const rest = all.slice(opts.top).reduce((n, b) => n + b.count, 0);
    return [...all.slice(0, opts.top), { label: 'Other', count: rest }];
  }
  return all;
}

// How far ahead of the event people claimed their tickets, in order from earliest to latest.
const TIMING_ORDER = ['3+ weeks before', '2–3 weeks', '1–2 weeks', '3–7 days', '1–2 days', 'Day of / after'] as const;
function claimTimingBuckets(createdAts: string[], startISO: string): Bucket[] {
  const counts = new Map<string, number>(TIMING_ORDER.map((k) => [k, 0]));
  for (const c of createdAts) {
    const d = pacificDaysUntil(startISO, new Date(c)); // days between claiming and the event's start day
    const label = d >= 21 ? TIMING_ORDER[0] : d >= 14 ? TIMING_ORDER[1] : d >= 8 ? TIMING_ORDER[2] : d >= 3 ? TIMING_ORDER[3] : d >= 1 ? TIMING_ORDER[4] : TIMING_ORDER[5];
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return TIMING_ORDER.map((label) => ({ label, count: counts.get(label) ?? 0 }));
}

// Aggregates only — no individual's private fields (gender etc.) leave this
// function. Callers must have already verified the viewer's capability, since
// this reads profile_private with the service role.
export async function getEventSummary(eventId: string, event: { start_date: string; end_date?: string | null; requires_checkin_form: boolean }): Promise<EventSummary> {
  const svc = createServiceClient();

  const { data: tickets } = await svc
    .from('tickets')
    .select('user_id, status, checked_in_at, checkin_form_completed_at, created_at, source')
    .eq('event_id', eventId);
  const all = tickets ?? [];
  const active = all.filter((t) => t.status !== 'cancelled');
  const attended = all.filter((t) => t.status === 'used');
  const attendeeIds = [...new Set(attended.map((t) => t.user_id))];

  const [profilesRes, privateRes, divisionsRes, priorRes, pointsRes, feedbackRes] = await Promise.all([
    attendeeIds.length ? svc.from('profiles').select('id, year, college, major, pronouns').in('id', attendeeIds) : Promise.resolve({ data: [] }),
    attendeeIds.length ? svc.from('profile_private').select('user_id, gender, platforms, favorite_games, division_interests').in('user_id', attendeeIds) : Promise.resolve({ data: [] }),
    svc.from('divisions').select('id, name'),
    attendeeIds.length
      ? svc.from('tickets').select('user_id, event:events!inner(start_date)').eq('status', 'used').in('user_id', attendeeIds).neq('event_id', eventId).lt('event.start_date', event.start_date)
      : Promise.resolve({ data: [] }),
    svc.from('point_transactions').select('amount').eq('event_id', eventId).eq('type', 'event_checkin'),
    svc.from('event_feedback').select('rating, comment').eq('event_id', eventId).order('created_at', { ascending: false }),
  ]);

  const profiles = (profilesRes.data ?? []) as { id: string; year: string | null; college: string | null; major: string | null; pronouns: string | null }[];
  const priv = (privateRes.data ?? []) as { user_id: string; gender: string | null; platforms: string[] | null; favorite_games: string | null; division_interests: string[] | null }[];
  const divisionName = new Map((divisionsRes.data ?? []).map((d) => [d.id as string, d.name as string]));
  const returningIds = new Set(((priorRes.data ?? []) as { user_id: string }[]).map((r) => r.user_id));

  // Arrival time, Pacific: by half hour for a one-day event; by day for a
  // multi-day one (a half-hour axis spanning a weekend isn't readable).
  const multiDay = eventDayCount(event.start_date, event.end_date) > 1;
  const dayCheckins = multiDay
    ? (await svc.from('ticket_checkins').select('ticket_id, day, checked_in_at').eq('event_id', eventId)).data ?? []
    : [];
  const arrivalCounts = new Map<string, { sort: number; count: number }>();
  const arrivalRows: { checked_in_at: string | null }[] = multiDay ? (dayCheckins as { checked_in_at: string | null }[]) : attended;
  for (const t of arrivalRows) {
    if (!t.checked_in_at) continue;
    const d = new Date(t.checked_in_at);
    let label: string; let sort: number;
    if (multiDay) {
      label = d.toLocaleDateString('en-US', { timeZone: PACIFIC_TZ, weekday: 'short', month: 'short', day: 'numeric' });
      sort = d.getTime() - (d.getTime() % 86400000);
    } else {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: PACIFIC_TZ, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(d);
      const h = Number(parts.find((p) => p.type === 'hour')?.value) % 24;
      const m = Number(parts.find((p) => p.type === 'minute')?.value) >= 30 ? 30 : 0;
      label = new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      sort = h * 60 + m;
    }
    const cur = arrivalCounts.get(label) ?? { sort, count: 0 };
    cur.count++;
    arrivalCounts.set(label, cur);
  }
  const arrivals = [...arrivalCounts.entries()].sort((a, b) => a[1].sort - b[1].sort).map(([label, v]) => ({ label, count: v.count }));

  // One row per attendee (a user could hold more than one ticket in theory).
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const privById = new Map(priv.map((p) => [p.user_id, p]));

  const parsed = attendeeIds.map((id) => parseMajors(profileById.get(id)?.major)).filter((p) => p.majors.length);
  const fb = (feedbackRes.data ?? []) as { rating: number; comment: string | null }[];

  return {
    registered: active.length,
    checkedIn: attended.length,
    noShows: active.length - attended.length,
    attendanceRate: active.length ? Math.round((attended.length / active.length) * 100) : 0,
    cancelled: all.length - active.length,
    firstTime: attendeeIds.filter((id) => !returningIds.has(id)).length,
    returning: attendeeIds.filter((id) => returningIds.has(id)).length,
    formOpened: event.requires_checkin_form ? attended.filter((t) => t.checkin_form_completed_at).length : null,
    pointsAwarded: (pointsRes.data ?? []).reduce((n, r) => n + (r.amount as number), 0),
    arrivals,
    gender: tally(attendeeIds.map((id) => privById.get(id)?.gender)),
    year: tally(attendeeIds.map((id) => profileById.get(id)?.year)),
    college: tally(attendeeIds.map((id) => profileById.get(id)?.college), { top: 8 }),
    // Majors are cleaned up (abbreviations, typos) and double majors count toward each major.
    major: tally(parsed.flatMap((p) => p.majors), { top: 10 }),
    field: tally(parsed.map((p) => p.fields[0]).filter(Boolean) as string[]),
    doubleMajors: parsed.filter((p) => p.majors.length > 1).length,
    pronouns: tally(attendeeIds.map((id) => profileById.get(id)?.pronouns)),
    platforms: tally(attendeeIds.flatMap((id) => privById.get(id)?.platforms ?? []), { top: 8 }),
    games: tally(attendeeIds.flatMap((id) => parseGames(privById.get(id)?.favorite_games)), { top: 10 }),
    claimTiming: claimTimingBuckets(active.map((t) => t.created_at as string), event.start_date),
    sources: tally(active.map((t) => (t.source as string | null) ?? null), { top: 8, blank: 'Not tracked' }),
    allDays: multiDay ? (() => { const n = new Map<string, number>(); for (const r of dayCheckins as { ticket_id: string }[]) n.set(r.ticket_id, (n.get(r.ticket_id) ?? 0) + 1); const total = eventDayCount(event.start_date, event.end_date); return [...n.values()].filter((c) => c >= total).length; })() : null,
    feedback: {
      count: fb.length,
      average: fb.length ? Math.round((fb.reduce((n, r) => n + r.rating, 0) / fb.length) * 10) / 10 : null,
      comments: fb.map((r) => r.comment?.trim() ?? '').filter(Boolean).slice(0, 20),
    },
    divisions: tally(attendeeIds.flatMap((id) => (privById.get(id)?.division_interests ?? []).map((d) => divisionName.get(d) ?? null)).filter(Boolean) as string[], { top: 8 }),
  };
}
