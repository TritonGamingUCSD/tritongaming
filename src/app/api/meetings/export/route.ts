import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { pacificDayKey } from '@/lib/checkinDays';
import { fetchLinkedEmails, pickDisplayEmails } from '@/lib/linkedEmails';
import { ROLE_DISPLAY_RANK, ROLE_LABELS, type AppRole } from '@/types/database';
import { addDaysKey, attachExtras, authorizeMeetings, loadGroups } from '@/lib/meetings';
import { AUDIENCE_ROLES, audienceLabel, isExpected } from '@/lib/meetingAudience';

export const dynamic = 'force-dynamic';

// CSV for HR. type=log: one row per person per meeting (present AND absent, so absences are on
// record). type=summary: one row per person with their totals. Range: ?from=&to= (Pacific dates),
// default the last 90 days. Opens in Excel/Sheets; a BOM keeps accented names intact.
function cell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;  // a name starting with "=" must not run as a spreadsheet formula
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const line = (cols: unknown[]) => cols.map(cell).join(',');
const pacificTime = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

export async function GET(request: Request) {
  const auth = await authorizeMeetings('manage_meetings');
  if (auth.error) return auth.error;
  const url = new URL(request.url);
  const type = url.searchParams.get('type') === 'summary' ? 'summary' : 'log';
  const today = pacificDayKey();
  const valid = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = valid(url.searchParams.get('from')) ?? addDaysKey(today, -90);
  const to = valid(url.searchParams.get('to')) ?? today;
  const titleFilter = url.searchParams.get('title');

  let q = auth.svc.from('meetings').select('id, title, meeting_date, starts_at, audience, invitees, group_ids')
    .eq('cancelled', false).not('opened_at', 'is', null).gte('meeting_date', from).lte('meeting_date', to).order('meeting_date').order('starts_at');
  if (titleFilter) q = q.eq('title', titleFilter);
  const { data: meetingRows } = await q;
  const groupMap = await loadGroups(auth.svc);
  const meetings = await attachExtras(auth.svc, (meetingRows ?? []).map((m) => ({ ...m, invitees: m.invitees as string[] | null, group_ids: m.group_ids as string[] | null })));
  const ids = (meetings ?? []).map((m) => m.id as string);
  const { data: abs } = ids.length ? await auth.svc.from('meeting_absences').select('meeting_id, user_id, reason, excused').in('meeting_id', ids) : { data: [] as { meeting_id: string; user_id: string; reason: string | null; excused: boolean }[] };
  const absByKey = new Map((abs ?? []).map((a) => [`${a.meeting_id}|${a.user_id}`, a]));
  const { data: att } = ids.length ? await auth.svc.from('meeting_attendance').select('meeting_id, user_id, checked_in_at, method').in('meeting_id', ids) : { data: [] as { meeting_id: string; user_id: string; checked_in_at: string; method: string }[] };

  // Everyone expected (team roles) plus anyone who attended without a current team role.
  const { data: grants } = await auth.svc.from('user_roles').select('user_id, role').in('role', [...AUDIENCE_ROLES]);
  const peopleIds = new Set<string>([...(grants ?? []).map((g) => g.user_id as string), ...(att ?? []).map((a) => a.user_id as string), ...(meetings ?? []).flatMap((m) => m.extra_ids), ...(abs ?? []).map((a) => a.user_id as string)]);
  const idList = [...peopleIds];
  const [{ data: profiles }, { data: allRoles }, emails] = await Promise.all([
    idList.length ? auth.svc.from('profiles').select('id, display_name, preferred_email').in('id', idList) : Promise.resolve({ data: [] as { id: string; display_name: string | null; preferred_email: string | null }[] }),
    idList.length ? auth.svc.from('user_roles').select('user_id, role').in('user_id', idList) : Promise.resolve({ data: [] as { user_id: string; role: AppRole }[] }),
    fetchLinkedEmails(auth.svc, idList),
  ]);
  const roleOf = new Map<string, string>();
  for (const id of idList) {
    const rs = (allRoles ?? []).filter((r) => r.user_id === id).map((r) => r.role as AppRole).sort((a, b) => ROLE_DISPLAY_RANK[b] - ROLE_DISPLAY_RANK[a]);
    roleOf.set(id, rs.map((r) => ROLE_LABELS[r]).join(' / '));
  }
  const people = (profiles ?? []).map((p) => ({
    id: p.id as string,
    name: (p.display_name as string | null) || 'Unnamed',
    email: pickDisplayEmails(emails.get(p.id as string) ?? [], p.preferred_email as string | null).map((e) => e.email).join('; '),
    role: roleOf.get(p.id as string) ?? '',
  })).sort((a, b) => a.name.localeCompare(b.name));
  const attByKey = new Map((att ?? []).map((a) => [`${a.meeting_id}|${a.user_id}`, a]));

  const rolesOf = new Map<string, { role: string }[]>();
  for (const g of grants ?? []) rolesOf.set(g.user_id as string, [...(rolesOf.get(g.user_id as string) ?? []), { role: g.role as string }]);
  // Expected = holds one of the meeting's roles, or was added. Someone who came anyway is listed as a guest and not counted.
  const expected = (m: { audience: string[] | null; extra_ids: string[] }, personId: string) => isExpected(m, personId, rolesOf.get(personId) ?? []);

  let rows: string[];
  if (type === 'log') {
    rows = [line(['Date', 'Meeting', 'Meant for', 'Name', 'Email', 'Role', 'Status', 'Reason', 'Checked in at (Pacific)', 'Method'])];
    for (const m of meetings ?? []) {
      for (const p of people) {
        const a = attByKey.get(`${m.id}|${p.id}`);
        const ab = absByKey.get(`${m.id}|${p.id}`);
        if (!a && !ab && !expected({ audience: m.audience as string[] | null, extra_ids: m.extra_ids }, p.id)) continue;   // the meeting wasn't for them
        rows.push(line([m.meeting_date, m.title, audienceLabel({ audience: m.audience as string[] | null, invitees: m.invitees, group_ids: m.group_ids, groupNames: (m.group_ids ?? []).map((g) => groupMap.get(g)?.name ?? '').filter(Boolean) }), p.name, p.email, p.role, a ? (expected({ audience: m.audience as string[] | null, extra_ids: m.extra_ids }, p.id) ? 'Present' : 'Present (guest)') : ab ? (ab.excused ? 'Excused absence' : 'Absent') : 'Absent', ab?.reason ?? '', a ? pacificTime(a.checked_in_at) : '', a ? (a.method === 'manual' ? 'Added by exec' : 'Code') : '']));
      }
    }
  } else {
    rows = [line(['Name', 'Email', 'Role', 'Meetings attended', 'Meetings expected', 'Excused absences', 'Attendance rate', 'Last attended'])];
    for (const p of people) {
      const excusedN = (meetings ?? []).filter((m) => absByKey.get(`${m.id}|${p.id}`)?.excused && !attByKey.has(`${m.id}|${p.id}`)).length;
      // Only meetings that were for this person count; coming to someone else's meeting is a guest visit.
      const relevant = (meetings ?? []).filter((m) => !(absByKey.get(`${m.id}|${p.id}`)?.excused) && expected({ audience: m.audience as string[] | null, extra_ids: m.extra_ids }, p.id));
      const mine = relevant.filter((m) => attByKey.has(`${m.id}|${p.id}`));
      const total = relevant.length;
      rows.push(line([p.name, p.email, p.role, mine.length, total, excusedN, total ? `${Math.round((mine.length / total) * 100)}%` : '', mine.length ? mine[mine.length - 1].meeting_date : '']));
    }
  }

  await logAudit(auth.svc, { actorId: auth.user.id, action: 'export', entityType: 'meeting attendance', summary: `Exported meeting attendance (${type}, ${from} to ${to})` });
  return new NextResponse('﻿' + rows.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="meeting-attendance-${type}-${from}-to-${to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
