import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/admin';
import { hasCapability } from '@/lib/capabilities';
import { rotatingCode, currentWindow, secondsUntilNextWindow } from '@/lib/rotatingCode';
import { pacificDayKey } from '@/lib/checkinDays';
import { pacificDatetimeLocalToUTC } from '@/lib/timezone';
import type { Capability } from '@/types/database';
import { audienceRoles, canAttendMeeting, isExpected, type MeetingAudience } from '@/lib/meetingAudience';

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
  group_ids: string[] | null;
  description: string | null;
  created_by: string | null;
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

// ── Saved groups, resolved live ──────────────────────────────────────────────
export interface GroupInfo { name: string; members: string[] }

export async function loadGroups(svc: SupabaseClient): Promise<Map<string, GroupInfo>> {
  const { data } = await svc.from('meeting_groups').select('id, name, member_ids');
  return new Map((data ?? []).map((g) => [g.id as string, { name: g.name as string, members: (g.member_ids as string[] | null) ?? [] }]));
}

// Adds `extra_ids` (individually added people + the CURRENT members of each chosen group) to meeting-like rows,
// so who's expected always reflects the groups as they are now.
export function withExtras<T extends { invitees: string[] | null; group_ids: string[] | null }>(rows: T[], groups: Map<string, GroupInfo>): (T & { extra_ids: string[] })[] {
  return rows.map((r) => ({ ...r, extra_ids: [...new Set([...(r.invitees ?? []), ...(r.group_ids ?? []).flatMap((g) => groups.get(g)?.members ?? [])])] }));
}
export async function attachExtras<T extends { invitees: string[] | null; group_ids: string[] | null }>(svc: SupabaseClient, rows: T[]) {
  return withExtras(rows, await loadGroups(svc));
}

export interface SeriesRow { id: string; title: string; weekday: number; start_time: string; end_time: string; location: string | null; active: boolean; doc_url: string | null; audience: string[] | null; invitees: string[] | null; group_ids: string[] | null; description: string | null; created_by: string | null }

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
  group_ids: string[] | null;
  groupNames: string[];
  description: string | null;
  host_id: string | null;
  host_name: string | null;
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
export async function buildSchedule(svc: SupabaseClient, forUser?: { id: string; roles: { role: string }[] }, ownerOnly?: string, opts: { strict?: boolean; horizonDays?: number } = {}): Promise<{ series: SeriesRow[]; upcoming: ScheduleItem[]; past: ScheduleItem[] }> {
  const today = pacificDayKey();
  const horizon = addDaysKey(today, opts.horizonDays ?? 14);
  const groups = await loadGroups(svc);
  const names = (ids: string[] | null) => (ids ?? []).map((g) => groups.get(g)?.name).filter((n): n is string => !!n);
  const [{ data: seriesData }, { data: rowData }] = await Promise.all([
    svc.from('meeting_series').select('id, title, weekday, start_time, end_time, location, active, doc_url, audience, invitees, group_ids, description, created_by').order('created_at'),
    svc.from('meetings').select('*').gte('meeting_date', addDaysKey(today, -30)).lte('meeting_date', horizon),
  ]);
  const series = (seriesData ?? []) as SeriesRow[];
  const rows = (rowData ?? []) as MeetingRow[];
  const hostIds = [...new Set([...rows.map((r) => r.created_by), ...series.map((x) => x.created_by)].filter((x): x is string => !!x))];
  const { data: hostProfiles } = hostIds.length ? await svc.from('profiles').select('id, display_name').in('id', hostIds) : { data: [] as { id: string; display_name: string | null }[] };
  const hostNames = new Map((hostProfiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) || 'Unnamed']));
  const ids = rows.map((r) => r.id);
  const { data: att } = ids.length ? await svc.from('meeting_attendance').select('meeting_id').in('meeting_id', ids) : { data: [] as { meeting_id: string }[] };
  const counts = new Map<string, number>();
  for (const a of att ?? []) counts.set(a.meeting_id, (counts.get(a.meeting_id) ?? 0) + 1);

  const now = Date.now();
  const fromRow = (r: MeetingRow): ScheduleItem => ({
    key: r.id, meeting_id: r.id, series_id: r.series_id, date: r.meeting_date, title: r.title, location: r.location, doc_url: r.doc_url, question: r.question, audience: r.audience, invitees: r.invitees, group_ids: r.group_ids, groupNames: names(r.group_ids), description: r.description, host_id: r.created_by, host_name: hostNames.get(r.created_by ?? '') ?? null,
    starts_at: r.starts_at, ends_at: r.ends_at, count: counts.get(r.id) ?? 0, is_today: r.meeting_date === today, repeats: !!r.series_id,
    status: r.cancelled ? 'cancelled' : isMeetingOpen(r, now) ? 'open' : (r.opened_at || r.meeting_date < today) ? 'closed' : 'scheduled',
  });
  // A lead only sees the meetings they planned.
  const items = rows.filter((r) => !ownerOnly || r.created_by === ownerOnly).map(fromRow);

  const taken = new Set(rows.filter((r) => r.series_id).map((r) => `${r.series_id}|${r.meeting_date}`));
  for (const s of series.filter((x) => x.active && (!ownerOnly || x.created_by === ownerOnly))) {
    for (let day = today; day <= horizon; day = addDaysKey(day, 1)) {
      if (weekdayOfKey(day) !== s.weekday || taken.has(`${s.id}|${day}`)) continue;
      const { starts, ends } = occurrenceTimes(day, s.start_time, s.end_time);
      items.push({ key: `${s.id}|${day}`, meeting_id: null, series_id: s.id, date: day, title: s.title, location: s.location, doc_url: s.doc_url, question: null, audience: s.audience, invitees: s.invitees, group_ids: s.group_ids, groupNames: names(s.group_ids), description: s.description, host_id: s.created_by, host_name: hostNames.get(s.created_by ?? '') ?? null, starts_at: starts.toISOString(), ends_at: ends.toISOString(), status: 'scheduled', count: 0, is_today: day === today, repeats: true });
    }
  }
  // A team member only sees the meetings meant for them; exec see everything.
  // `strict` is the "what's on for me" view: only meetings meant for the person (or planned by them), so
  // exec/admin don't see meetings they weren't invited to just because they could check in to them.
  const visible = forUser ? items.filter((i) => {
    const m = { ...i, extra_ids: withExtras([i], groups)[0].extra_ids };
    return opts.strict ? i.host_id === forUser.id || isExpected(m, forUser.id, forUser.roles) : canAttendMeeting(m, forUser.id, forUser.roles);
  }) : items;
  const upcoming = visible.filter((i) => i.date >= today).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = visible.filter((i) => i.date < today && i.status !== 'cancelled').sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return { series: ownerOnly ? series.filter((x) => x.created_by === ownerOnly) : series, upcoming, past };
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

export async function authorizeMeetings(capability: Extract<Capability, 'manage_meetings' | 'attend_meetings' | 'host_meetings'>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: roles } = await supabase.from('user_roles').select('role, division_id').eq('user_id', user.id);
  const grants = roles ?? [];
  if (!hasCapability(grants, capability)) {
    const msg = capability === 'attend_meetings' ? 'Meeting check-in is for officers, leads, exec and recruits.'
      : capability === 'host_meetings' ? 'Only leads, exec and admins can plan meetings.'
      : 'Only exec and admins can do that.';
    return { error: NextResponse.json({ error: msg }, { status: 403 }) };
  }
  // Exec/admin manage every meeting; a lead only the ones they planned (see canManageMeeting).
  return { user, roles: grants, svc: createServiceClient(), manageAll: hasCapability(grants, 'manage_meetings') };
}

type Host = { user: { id: string }; manageAll: boolean };
// May this host run/edit/see results of a meeting (or series) that was planned by `createdBy`?
export const canManageMeeting = (auth: Host, createdBy: string | null | undefined) => auth.manageAll || createdBy === auth.user.id;
export async function guardMeeting(auth: Host & { svc: SupabaseClient }, id: string): Promise<NextResponse | null> {
  const { data } = await auth.svc.from('meetings').select('created_by').eq('id', id).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  return canManageMeeting(auth, data.created_by as string | null) ? null : notYourMeeting();
}
export async function guardSeries(auth: Host & { svc: SupabaseClient }, id: string): Promise<NextResponse | null> {
  const { data } = await auth.svc.from('meeting_series').select('created_by').eq('id', id).maybeSingle();
  if (!data) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  return canManageMeeting(auth, data.created_by as string | null) ? null : notYourMeeting();
}
export const notYourMeeting = () => NextResponse.json({ error: 'That meeting was planned by someone else. Only its host, exec and admins can change it.' }, { status: 403 });

export async function getTodaysMeetings(svc: SupabaseClient): Promise<(MeetingRow & { extra_ids: string[] })[]> {
  const { data } = await svc.from('meetings').select('*').eq('meeting_date', pacificDayKey()).eq('cancelled', false).order('starts_at');
  return attachExtras(svc, (data as MeetingRow[] | null) ?? []);
}

export interface PersonRow { id: string; name: string; avatar_url: string | null; custom_avatar_url: string | null }

// Everyone expected at a Gen Meeting: holds officer, lead, exec or recruit.
export async function getExpectedPeople(svc: SupabaseClient, m?: MeetingAudience & { invitees?: string[] | null; group_ids?: string[] | null }): Promise<PersonRow[]> {
  const extras = m ? (m.extra_ids ?? (await attachExtras(svc, [{ invitees: m.invitees ?? null, group_ids: m.group_ids ?? null }]))[0].extra_ids) : [];
  const roles = audienceRoles(m ?? { audience: null });
  const { data: grants } = roles.length ? await svc.from('user_roles').select('user_id').in('role', roles) : { data: [] as { user_id: string }[] };
  const ids = [...new Set([...(grants ?? []).map((g) => g.user_id as string), ...extras])];
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
  const groups = await loadGroups(svc);
  const { data: series } = await svc.from('meeting_series').select('id, weekday, start_time, end_time, audience, invitees, group_ids').eq('active', true).eq('weekday', weekdayOfKey(today));
  return (series ?? []).some((s) => {
    if (rows.some((r) => r.series_id === s.id)) return false; // already a real row, handled above
    const sx = withExtras([{ invitees: s.invitees as string[] | null, group_ids: s.group_ids as string[] | null }], groups)[0];
    if (!canAttendMeeting({ audience: s.audience as string[] | null, extra_ids: sx.extra_ids, invitees: sx.invitees, group_ids: sx.group_ids }, user.id, user.roles)) return false;
    const { starts, ends } = occurrenceTimes(today, s.start_time as string, s.end_time as string);
    return near(starts.toISOString(), ends.toISOString());
  });
}

type AudienceSpec = MeetingAudience & { invitees?: string[] | null; group_ids?: string[] | null };

// Tell people they were added to a meeting (in-app bell). Pass `before` when the audience was
// edited so only people who weren't already invited are notified. The host is never notified.
export async function notifyMeetingInvites(
  svc: SupabaseClient,
  meeting: { title: string; when: string },
  after: AudienceSpec,
  opts: { before?: AudienceSpec; hostId?: string } = {},
): Promise<number> {
  const [now, prev] = await Promise.all([getExpectedPeople(svc, after), opts.before ? getExpectedPeople(svc, opts.before) : Promise.resolve([])]);
  const skip = new Set([...prev.map((p) => p.id), ...(opts.hostId ? [opts.hostId] : [])]);
  const rows = now.filter((p) => !skip.has(p.id)).map((p) => ({
    user_id: p.id,
    type: 'meeting_invite',
    title: `You’re invited to ${meeting.title}`,
    body: meeting.when,
    href: '/portal?section=meetings&tab=mine',
  }));
  if (rows.length === 0) return 0;
  const { error } = await svc.from('notifications').insert(rows);
  return error ? 0 : rows.length;
}
