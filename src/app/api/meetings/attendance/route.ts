import { NextResponse } from 'next/server';
import { pacificDayKey } from '@/lib/checkinDays';
import { AUDIENCE_ROLES, audienceRoles, isExpected } from '@/lib/meetingAudience';
import { addDaysKey, attachExtras, authorizeMeetings } from '@/lib/meetings';
import { ROLE_DISPLAY_RANK, ROLE_LABELS, type AppRole } from '@/types/database';

export const dynamic = 'force-dynamic';

// Everything the Attendance page shows, for a date range and optionally one kind of meeting:
// per-meeting turnout, per-person rates/streaks/dot strips, and headline numbers. A meeting only
// counts toward someone if it was meant for them (they hold one of its roles) or they came anyway.
export async function GET(request: Request) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const today = pacificDayKey();
  const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = valid(url.searchParams.get('from')) ?? addDaysKey(today, -90);
  const to = valid(url.searchParams.get('to')) ?? today;
  const title = url.searchParams.get('title');

  let allQ = auth.svc.from('meetings').select('id, title, meeting_date, audience, invitees, group_ids')
    .eq('cancelled', false).not('opened_at', 'is', null).gte('meeting_date', from).lte('meeting_date', to)  .order('meeting_date').order('starts_at').limit(300);
  // A lead sees results only for the meetings they planned.
  if (!auth.manageAll) allQ = allQ.eq('created_by', auth.user.id);
  const { data: all } = await allQ;
  const inRange = await attachExtras(auth.svc, (all ?? []).map((m) => ({ ...m, invitees: m.invitees as string[] | null, group_ids: m.group_ids as string[] | null })));
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
  const peopleIds = new Set<string>([...rolesOf.keys(), ...(rows ?? []).map((r) => r.user_id as string), ...meetings.flatMap((m) => m.extra_ids), ...(absRows ?? []).map((a) => a.user_id as string)]);
  const { data: profiles } = peopleIds.size
    ? await auth.svc.from('profiles').select('id, display_name, avatar_url, custom_avatar_url').in('id', [...peopleIds])
    : { data: [] as { id: string; display_name: string | null; avatar_url: string | null; custom_avatar_url: string | null }[] };

  const people = (profiles ?? []).map((p) => {
    const roles = rolesOf.get(p.id as string) ?? [];
    // One mark per meeting, oldest → newest: p = present, a = absent (was expected), e = excused
    // absence (doesn't count), g = came as a guest to a meeting not meant for them (doesn't count),
    // - = not meant for them.
    const marks = meetings.map((m) => {
      const expectedHere = isExpected({ audience: m.audience as string[] | null, extra_ids: m.extra_ids }, p.id as string, roles);
      // Came to a meeting that wasn't meant for them (exec/admin often do): shown, but not counted.
      if (present.get(m.id as string)?.has(p.id as string)) return expectedHere ? 'p' : 'g';
      const abs = absences.get(`${m.id}|${p.id}`);
      if (abs === true) return 'e';
      if (abs === false) return 'a';
      return expectedHere ? 'a' : '-';
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
  }).filter((p) => p.total > 0 || p.excused > 0 || p.marks.includes('g'));

  const meetingRows = meetings.map((m) => {
    const excusedHere = [...absences.entries()].filter(([k, ex]) => ex && k.startsWith(`${m.id}|`)).length;
    const roleHolders = audienceRoles({ audience: m.audience as string[] | null, invitees: m.invitees, group_ids: m.group_ids });
    const holders = new Set([...rolesOf.entries()].filter(([, r]) => r.some((x) => roleHolders.includes(x.role))).map(([id]) => id));
    for (const id of m.extra_ids) holders.add(id);
    const expectedRaw = holders.size;
    const expected = Math.max(0, expectedRaw - excusedHere);
    // Turnout counts people the meeting was for; anyone else who came is a guest, listed separately.
    const here = present.get(m.id as string) ?? new Set<string>();
    const counted = [...here].filter((id) => holders.has(id)).length;
    return { id: m.id as string, title: m.title as string, meeting_date: m.meeting_date as string, audience: m.audience as string[] | null, invitees: m.invitees, group_ids: m.group_ids, count: counted, guests: here.size - counted, expected };
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
