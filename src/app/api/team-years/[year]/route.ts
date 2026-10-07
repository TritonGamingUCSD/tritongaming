import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { academicYearLabel, authorizeQuarters } from '@/lib/members/quarters';
import { TIERS, archiveYear, type Tier } from '@/lib/members/teamYears';
import { resolveAvatarUrl } from '@/lib/members/profile';
import { invalidate } from '@/lib/site/revalidate';

const UUID = /^[0-9a-f-]{36}$/i;

// { action: 'archive' }                                  record (or rebuild) this year from its quarters. Exec and admins. Names added by hand are kept.
// { action: 'add', user_id? | name?, tier, title? }      add someone to the year by hand (admin): an existing member, or just a name for an earlier year.
export async function POST(request: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const startYear = Number(year);
  if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) return NextResponse.json({ error: 'Year not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  if (b.action === 'archive') {
    const auth = await authorizeQuarters('manage');
    if (auth.error) return auth.error;
    const n = await archiveYear(auth.svc, startYear, auth.user.id);
    await logAudit(auth.svc, { actorId: auth.user.id, action: 'archive', entityType: 'team year', entityId: String(startYear), summary: `Recorded the ${academicYearLabel(startYear)} team (${n} people)` });
    return NextResponse.json({ ok: true, count: n });
  }
  if (b.action !== 'add') return NextResponse.json({ error: 'Say what to do.' }, { status: 400 });
  const auth = await authorizeQuarters('setup');
  if (auth.error) return auth.error;
  if (!(TIERS as string[]).includes(String(b.tier))) return NextResponse.json({ error: 'Pick exec, lead or officer.' }, { status: 400 });
  const title = String(b.title ?? '').trim().slice(0, 80) || null;
  let name = String(b.name ?? '').trim().slice(0, 80);
  let userId: string | null = null;
  let avatar: string | null = null;
  if (b.user_id) {
    if (!UUID.test(String(b.user_id))) return NextResponse.json({ error: 'Person not found.' }, { status: 404 });
    const { data: p } = await auth.svc.from('profiles').select('id, display_name, avatar_url, custom_avatar_url').eq('id', String(b.user_id)).maybeSingle();
    if (!p) return NextResponse.json({ error: 'Person not found.' }, { status: 404 });
    userId = p.id as string; name = (p.display_name as string | null) || name || 'Unnamed';
    avatar = resolveAvatarUrl({ avatar_url: p.avatar_url as string | null, custom_avatar_url: p.custom_avatar_url as string | null });
  }
  if (!name) return NextResponse.json({ error: 'Add a name.' }, { status: 400 });
  await auth.svc.from('team_years').upsert({ start_year: startYear, archived_at: new Date().toISOString(), archived_by: auth.user.id, auto: false }, { onConflict: 'start_year', ignoreDuplicates: true });
  const { data, error } = await auth.svc.from('team_year_members').insert({ start_year: startYear, user_id: userId, name, title, tier: b.tier as Tier, avatar_url: avatar, manual: true }).select('id').single();
  if (error || !data) return NextResponse.json({ error: error?.code === '23505' ? 'They’re already on this year’s list.' : 'Failed to save.' }, { status: error?.code === '23505' ? 400 : 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'team year', entityId: String(startYear), summary: `Added ${name} to the ${academicYearLabel(startYear)} team` });
  invalidate('board');
  return NextResponse.json({ id: data.id }, { status: 201 });
}
