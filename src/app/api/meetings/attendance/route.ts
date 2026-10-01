import { NextResponse } from 'next/server';
import { pacificDayKey } from '@/lib/checkinDays';
import { AUDIENCE_ROLES, hasInvitees, isExpected } from '@/lib/meetingAudience';
import { addDaysKey, authorizeMeetings } from '@/lib/meetings';
import { ROLE_DISPLAY_RANK, ROLE_LABELS, type AppRole } from '@/types/database';

export const dynamic = 'force-dynamic';

// Everything the Attendance page shows, for a date range and optionally one kind of meeting:
// per-meeting turnout, per-person rates/streaks/dot strips, and headline numbers. A meeting only
// counts toward someone if it was meant for them (they hold one of its roles) or they came anyway.
export async function GET(request: Request) {
  const auth = await authorizeMeetings('manage_meetings');
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const today = pacificDayKey();
  const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = valid(url.searchParams.get('from')) ?? addDaysKey(today, -90);
  const to = valid(url.searchParams.get('to')) ?? today;
  const title = url.searchParams.get('title');

  const { data: all } = await auth.svc.from('meetings').select('id, title, meeting_date, audience, invitees')
    .eq('cancelled', false).not('opened_at', 'is', null).gte('meeting_date', from).lte('meeting_date', to).order('meeting_date').order('starts_at').limit(300);
  const inRange = all ?? [];
  const titles = [...new Set(inRange.map((m) => m.title as string))].sort();
  const meetings = title ? inRange.filter((m) => m.title === title) : inRange;
  const ids = meetings.map((m) => m.id as string);

  const [{ data: rows }, { data: grants }, { data: absRows }] = await Promise.all([
    ids.length ? auth.svc.from('meeting_attendance').select('meeting_id, user_id').in('meeting_id', ids) : Promise.resolve({ data: [] as { meeting_id: string; user_id: string }[] }),
    auth.svc.from('user_roles').select('user_id, role').in('role', [...AUDIENCE_ROLES]),
    ids.length ? auth.svc.from('meeting_absences').select('meeting_id, user_id, excused').in('meeting_id', ids) : Promise.resolve({ data: [] as { meeting_id: string; user_id: string; excused: boolean }[] }),
  ]);
  const absences = new Map<string, boolean>();   // `${meeting}|${user}` → excused
  for (const a of absRows ?? []) absences.set(`${a.meeting_id}|${a.user_id}`, a.excused as boolean);
  const present = new Map<string, Set<string>>();   // meeting id → user ids
  for (const r of rows ?? []) {
    const set = present.get(r.meeting_id as string) ?? new Set<string>();
    set.add(r.user_id as string);
    present.set(r.meeting_id as string, set);
  }
  const rolesOf = new Map<string, { role: string }[]>();
  for (const g of grants ?? []) rolesOf.set(g.user_id as string, [...(rolesOf.get(g.user_id as string) ?? []), { role: g.role as string }]);
  const peopleIds = new Set<string>([...rolesOf.keys(), ...(rows ?? []).map((r) => r.user_id as string), ...meetings.flatMap((m) => (m.invitees as string[] | null) ?? []), ...(absRows ?? []).map((a) => a.user_id as string)]);
  const { data: profiles } = peopleIds.size
    ? await auth.svc.from('profiles').select('id, display_name, avatar_url, custom_avatar_url').in('id', [...peopleIds])
    : { data: [] as { id: string; display_name: string | null; avatar_url: string | null; custom_avatar_url: string | null }[] };

  const people = (profiles ?? []).map((p) => {
    const roles = rolesOf.get(p.id as string) ?? [];
    // One mark per meeting, oldest → newest: p = present, a = absent (was expected), e = excused
    // absence (doesn't count), - = not meant for them.
    const marks = meetings.map((m) => {
      if (present.get(m.id as string)?.has(p.id as string)) return 'p';
      const abs = absences.get(`${m.id}|${p.id}`);
      if (abs === true) return 'e';
      if (abs === false) return 'a';
      return isExpected({ audience: m.audience as string[] | null, invitees: m.invitees as string[] | null }, p.id as string, roles) ? 'a' : '-';
    });
    const total = marks.filter((x) => x === 'p' || x === 'a').length;
    const excusedCount = marks.filter((x) => x === 'e').length;
    const attended = marks.filter((x) => x === 'p').length;
    let streak = 0, missedRun = 0;
    for (let i = marks.length - 1; i >= 0; i--) { if (marks[i] === '-' || marks[i] === 'e') continue; if (marks[i] === 'p' && missedRun === 0) streak++; else if (marks[i] === 'a' && streak === 0) missedRun++; else break; }
    const lastIdx = marks.lastIndexOf('p');
    const top = [...roles].map((r) => r.role as AppRole).sort((a, b) => ROLE_DISPLAY_RANK[b] - ROLE_DISPLAY_RANK[a])[0];
    return {
      id: p.id as string, name: (p.display_name as string | null) || 'Unnamed', avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null,
      role: top ? ROLE_LABELS[top] : '', attended, total, excused: excusedCount, rate: total ? attended / total : null, streak, missedRun, marks,
      last_attended: lastIdx >= 0 ? (meetings[lastIdx].meeting_date as string) : null,
      follow_up: total >= 3 && ((attended / total) < 0.5 || missedRun >= 3),
    };
  }).filter((p) => p.total > 0 || p.excused > 0);

  const meetingRows = meetings.map((m) => {
    const invitees = m.invitees as string[] | null;
    const excusedHere = [...absences.entries()].filter(([k, ex]) => ex && k.startsWith(`${m.id}|`)).length;
    const expectedRaw = hasInvitees({ audience: null, invitees }) ? invitees!.length : [...rolesOf.entries()].filter(([, r]) => isExpected({ audience: m.audience as string[] | null }, '', r)).length;
    const expected = Math.max(0, expectedRaw - excusedHere);
    return { id: m.id as string, title: m.title as string, meeting_date: m.meeting_date as string, audience: m.audience as string[] | null, invitees, count: present.get(m.id as string)?.size ?? 0, expected };
  });
  const rated = people.filter((p) => p.rate !== null);
  return NextResponse.json({
    from, to, titles,
    meetings: meetingRows,
    people,
    summary: {
      held: meetingRows.length,
      avgTurnout: meetingRows.length ? Math.round((meetingRows.reduce((n, m) => n + m.count, 0) / meetingRows.length) * 10) / 10 : 0,
      avgRate: rated.length ? rated.reduce((n, p) => n + (p.rate as number), 0) / rated.length : null,
      followUp: people.filter((p) => p.follow_up).length,
    },
  });
}
