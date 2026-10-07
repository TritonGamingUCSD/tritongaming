import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { pacificDayKey } from '@/lib/events/checkinDays';
import { authorizeQuarters } from '@/lib/members/quarters';
import { alumniCandidates, moveToAlumni } from '@/lib/members/teamYears';

// Graduates (June 30 of their class year) who were active at least once: move them to Alumni (drops their officer, lead or exec role, which is kept in the
// year lists), or switch the daily automatic move on or off. Admin only.
//   { action: 'move', user_ids? }   (default: everyone ready)
//   { action: 'auto', on: boolean }
export async function POST(request: Request) {
  const auth = await authorizeQuarters('setup');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  if (b.action === 'auto') {
    if (typeof b.on !== 'boolean') return NextResponse.json({ error: 'Say on or off.' }, { status: 400 });
    await auth.svc.from('team_settings').upsert({ key: 'auto_alumni', value: b.on ? 'on' : 'off' }, { onConflict: 'key' });
    await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'team year', entityId: null, summary: `Turned moving graduates to Alumni ${b.on ? 'on' : 'off'}` });
    return NextResponse.json({ ok: true });
  }
  if (b.action !== 'move') return NextResponse.json({ error: 'Say what to do.' }, { status: 400 });
  const ready = await alumniCandidates(auth.svc, pacificDayKey());
  const want: string[] | null = Array.isArray(b.user_ids) ? b.user_ids.map(String) : null;
  const ids = ready.filter((r) => !want || want.includes(r.id)).map((r) => r.id);
  const n = await moveToAlumni(auth.svc, ids, auth.user.id);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'team year', entityId: null, summary: `Moved ${n} ${n === 1 ? 'graduate' : 'graduates'} to Alumni` });
  return NextResponse.json({ ok: true, moved: n });
}
