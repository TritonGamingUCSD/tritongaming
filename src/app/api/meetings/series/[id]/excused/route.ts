import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { authorizeMeetings, getExpectedPeople, guardSeries, markEveryWeek, stopEveryWeek } from '@/lib/meetings';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;

// Standing excuses for a repeating meeting: someone excused every week for as long as it repeats.
//   GET                          who the series is for + who is excused every week
//   POST   { user_id, reason?, excused? }   excuse them every week (the series remembers; coming unopened weeks get the mark)
//   DELETE { user_id }           stop it
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  { const denied = await guardSeries(auth, id); if (denied) return denied; }
  const { data: series } = await auth.svc.from('meeting_series').select('audience, invitees, group_ids').eq('id', id).maybeSingle();
  if (!series) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
  const expected = await getExpectedPeople(auth.svc, { audience: series.audience, invitees: series.invitees, group_ids: series.group_ids });
  const { data: rows } = await auth.svc.from('meeting_series_absences').select('user_id, reason, excused, plan_id').eq('series_id', id);
  const name = new Map(expected.map((p) => [p.id, p.name]));
  const missing = (rows ?? []).map((r) => r.user_id as string).filter((u) => !name.has(u));
  if (missing.length) {
    const { data: ps } = await auth.svc.from('profiles').select('id, display_name').in('id', missing);
    for (const p of ps ?? []) name.set(p.id as string, (p.display_name as string | null) || 'Unnamed');
  }
  return NextResponse.json({
    people: expected.map((p) => ({ id: p.id, name: p.name })),
    excused: (rows ?? []).map((r) => ({ user_id: r.user_id, name: name.get(r.user_id as string) ?? 'Unnamed', reason: r.reason, excused: r.excused, from_plan: !!r.plan_id })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  { const denied = await guardSeries(auth, id); if (denied) return denied; }
  const b = await request.json().catch(() => ({}));
  if (!b.user_id || !UUID.test(String(b.user_id))) return NextResponse.json({ error: 'Pick who to excuse.' }, { status: 400 });
  const reason = String(b.reason ?? '').trim().slice(0, 140) || null;
  const excused = b.excused !== false;
  await markEveryWeek(auth.svc, id, String(b.user_id), reason, excused, auth.user.id);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'mark absent', entityType: 'meeting series', entityId: id, summary: `Excused someone every week${reason ? `: ${reason}` : ''}`, details: { user_id: b.user_id } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeMeetings('host_meetings');
  if (auth.error) return auth.error;
  const { id } = await params;
  { const denied = await guardSeries(auth, id); if (denied) return denied; }
  const b = await request.json().catch(() => ({}));
  if (!b.user_id || !UUID.test(String(b.user_id))) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  await stopEveryWeek(auth.svc, id, String(b.user_id));
  return NextResponse.json({ ok: true });
}
