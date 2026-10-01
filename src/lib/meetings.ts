import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { rotatingCode, currentWindow, secondsUntilNextWindow } from '@/lib/rotatingCode';
import { pacificDayKey } from '@/lib/checkinDays';
import { pacificDatetimeLocalToUTC } from '@/lib/timezone';
import type { Capability } from '@/types/database';
import { audienceRoles, canAttendMeeting, hasInvitees, type MeetingAudience } from '@/lib/meetingAudience';

// Gen Meeting check-in (see migration 20261002140000_gen_meetings.sql). An exec opens check-in and
// shows a rotating 6-digit code in the room; people on the team type it into the portal.

export const GRACE_MS = 30 * 60_000;
// Members can check in this long BEFORE the meeting starts (so people arriving a few minutes early
// can get it done), but not hours ahead of time.
export const EARLY_MS = 10 * 60_000;

export interface MeetingRow {
  id: string;
  title: string;
  meeting_date: string;
  starts_at: string;
  ends_at: string;
  code_secret: string;
  opened_by: string | null;
  opened_at: string | null;
  closed_at: string | null;
  series_id: string | null;
  location: string | null;
  cancelled: boolean;
  doc_url: string | null;
  question: string | null;
  audience: string[] | null;
  invitees: string[] | null;
}

// Open = an exec started it, hasn't closed it, and it's not long past its scheduled end.
export function isMeetingOpen(m: Pick<MeetingRow, 'ends_at' | 'closed_at' | 'opened_at'>, now: number = Date.now()): boolean {
  return !!m.opened_at && !m.closed_at && now < new Date(m.ends_at).getTime() + GRACE_MS;
}

// When members may start checking in: a little before the meeting starts.
export function checkInOpensAt(m: Pick<MeetingRow, 'starts_at'>): number { return new Date(m.starts_at).getTime() - EARLY_MS; }

// Open for members right now: an exec has opened it, it isn't over, and the early-arrival window has begun.
export function isCheckInAccepting(m: Pick<MeetingRow, 'starts_at' | 'ends_at' | 'closed_at' | 'opened_at'>, now: number = Date.now()): boolean {
  return isMeetingOpen(m, now) && now >= checkInOpensAt(m);
}

export interface SeriesRow { id: string; title: string; weekday: number; start_time: string; end_time: string; location: string | null; active: boolean; doc_url: string | null; audience: string[] | null; invitees: string[] | null }

// A meeting doc link: a full http(s) URL, or a path inside this site (like a portal doc). Empty clears it.
export function validateDocUrl(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  const v = String(raw ?? '').trim();
  if (!v) return { ok: true, value: null };
  if (v.length > 500) return { ok: false };
  if (v.startsWith('/') && !v.startsWith('//')) return { ok: true, value: v };
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:' ? { ok: true, value: u.toString() } : { ok: false }; } catch { return { ok: false }; }
}

export interface ScheduleItem {
  key: string;
  meeting_id: string | null;   // null until an exec opens (or skips) this occurrence
  series_id: string | null;
  date: string;
  title: string;
  location: string | null;
  doc_url: string | null;
  question: string | null;
  audience: string[] | null;
  invitees: string[] | null;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'open' | 'closed' | 'cancelled';
  count: number;
  is_today: boolean;
  repeats: boolean;
}

export function addDaysKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function weekdayOfKey(key: string): number { return new Date(`${key}T12:00:00Z`).getUTCDay(); }
const hhmm = (t: string) => t.slice(0, 5);
export function occurrenceTimes(day: string, startTime: string, endTime: string) {
  return { starts: pacificDatetimeLocalToUTC(`${day}T${hhmm(startTime)}`), ends: pacificDatetimeLocalToUTC(`${day}T${hhmm(endTime)}`) };
}

// The next two weeks of meetings (real rows plus not-yet-opened occurrences of repeating series)
// and the last month of past ones.
export async function buildSchedule(svc: SupabaseClient, forUser?: { id: string; roles: { role: string }[] }): Promise<{ series: SeriesRow[]; upcoming: ScheduleItem[]; past: ScheduleItem[] }> {
  const today = pacificDayKey();
  const horizon = addDaysKey(today, 14);
  const [{ data: seriesData }, { data: rowData }] = await Promise.all([
    svc.from('meeting_series').select('id, title, weekday, start_time, end_time, location, active, doc_url, audience, invitees').order('created_at'),
    svc.from('meetings').select('*').gte('meeting_date', addDaysKey(today, -30)).lte('meeting_date', horizon),
  ]);
  const series = (seriesData ?? []) as SeriesRow[];
  const rows = (rowData ?? []) as MeetingRow[];
  const ids = rows.map((r) => r.id);
  const { data: att } = ids.length ? await svc.from('meeting_attendance').select('meeting_id').in('meeting_id', ids) : { data: [] as { meeting_id: string }[] };
  const counts = new Map<string, number>();
  for (const a of att ?? []) counts.set(a.meeting_id, (counts.get(a.meeting_id) ?? 0) + 1);

  const now = Date.now();
  const fromRow = (r: MeetingRow): ScheduleItem => ({
    key: r.id, meeting_id: r.id, series_id: r.series_id, date: r.meeting_date, title: r.title, location: r.location, doc_url: r.doc_url, question: r.question, audience: r.audience, invitees: r.invitees,
    starts_at: r.starts_at, ends_at: r.ends_at, count: counts.get(r.id) ?? 0, is_today: r.meeting_date === today, repeats: !!r.series_id,
    status: r.cancelled ? 'cancelled' : isMeetingOpen(r, now) ? 'open' : (r.opened_at || r.meeting_date < today) ? 'closed' : 'scheduled',
  });
  const items = rows.map(fromRow);

  const taken = new Set(rows.filter((r) => r.series_id).map((r) => `${r.series_id}|${r.meeting_date}`));
  for (const s of series.filter((x) => x.active)) {
    for (let day = today; day <= horizon; day = addDaysKey(day, 1)) {
      if (weekdayOfKey(day) !== s.weekday || taken.has(`${s.id}|${day}`)) continue;
      const { starts, ends } = occurrenceTimes(day, s.start_time, s.end_time);
      items.push({ key: `${s.id}|${day}`, meeting_id: null, series_id: s.id, date: day, title: s.title, location: s.location, doc_url: s.doc_url, question: null, audience: s.audience, invitees: s.invitees, starts_at: starts.toISOString(), ends_at: ends.toISOString(), status: 'scheduled', count: 0, is_today: day === today, repeats: true });
    }
  }
  // A team member only sees the meetings meant for them; exec see everything.
  const visible = forUser ? items.filter((i) => canAttendMeeting(i, forUser.id, forUser.roles)) : items;
  const upcoming = visible.filter((i) => i.date >= today).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = visible.filter((i) => i.date < today && i.status !== 'cancelled').sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return { series, upcoming, past };
}

// The code people should be typing right now, and when it changes.
export function currentMeetingCode(secret: string): { code: string; expiresAt: number } {
  return { code: rotatingCode(secret, currentWindow()), expiresAt: Date.now() + secondsUntilNextWindow() * 1000 };
}

// The previous window is accepted too, so a code that rolls over while someone is typing still works.
export function isValidMeetingCode(secret: string, input: string): boolean {
  const w = currentWindow();
  const c = input.trim();
  return rotatingCode(secret, w) === c || rotatingCode(secret, w - 1) === c;
}

export async function authorizeMeetings(capability: Extract<Capability, 'manage_meetings' | 'attend_meetings'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  if (!hasCapability(roles ?? [], capability)) {
    return { error: NextResponse.json({ error: capability === 'manage_meetings' ? 'Only exec can run meeting check-in.' : 'Meeting check-in is for officers, leads, exec and recruits.' }, { status: 403 }) };
  }
  return { user, roles: roles ?? [], svc: createServiceClient() };
}

export async function getTodaysMeetings(svc: SupabaseClient): Promise<MeetingRow[]> {
  const { data } = await svc.from('meetings').select('*').eq('meeting_date', pacificDayKey()).eq('cancelled', false).order('starts_at');
  return (data as MeetingRow[] | null) ?? [];
}

export interface PersonRow { id: string; name: string; avatar_url: string | null; custom_avatar_url: string | null }

// Everyone expected at a Gen Meeting: holds officer, lead, exec or recruit.
export async function getExpectedPeople(svc: SupabaseClient, m?: MeetingAudience): Promise<PersonRow[]> {
  let ids: string[];
  if (m && hasInvitees(m)) {
    ids = m.invitees!;
  } else {
    const { data: grants } = await svc.from('user_roles').select('user_id').in('role', audienceRoles(m?.audience));
    ids = [...new Set((grants ?? []).map((g) => g.user_id as string))];
  }
  if (ids.length === 0) return [];
  const { data: profiles } = await svc.from('profiles').select('id, display_name, avatar_url, custom_avatar_url').in('id', ids);
  return (profiles ?? [])
    .map((p) => ({ id: p.id as string, name: (p.display_name as string | null) || 'Unnamed', avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Is a meeting happening around now (from 2 hours before it starts until an hour after it ends)?
// Drives the mobile bar's "Meetings" slot. Counts a repeating meeting's occurrence for today even
// before an exec has opened it.
export async function meetingHappeningNow(svc: SupabaseClient, user: { id: string; roles: { role: string }[] }, now: Date = new Date()): Promise<boolean> {
  const t = now.getTime();
  const near = (starts: string, ends: string) => t >= new Date(starts).getTime() - 2 * 3600_000 && t <= new Date(ends).getTime() + 3600_000;
  const rows = (await getTodaysMeetings(svc)).filter((m) => canAttendMeeting(m, user.id, user.roles));
  if (rows.some((m) => isMeetingOpen(m, t) || near(m.starts_at, m.ends_at))) return true;
  const today = pacificDayKey(now);
  const { data: series } = await svc.from('meeting_series').select('id, weekday, start_time, end_time, audience, invitees').eq('active', true).eq('weekday', weekdayOfKey(today));
  return (series ?? []).some((s) => {
    if (rows.some((r) => r.series_id === s.id)) return false; // already a real row, handled above
    if (!canAttendMeeting({ audience: s.audience as string[] | null, invitees: s.invitees as string[] | null }, user.id, user.roles)) return false;
    const { starts, ends } = occurrenceTimes(today, s.start_time as string, s.end_time as string);
    return near(starts.toISOString(), ends.toISOString());
  });
}
