import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { pacificDayKey } from '@/lib/events/checkinDays';
import { authorizeQuarters, canBeInactive, loadQuarters, markableQuarters, quarterName, syncInactive } from '@/lib/members/quarters';

const UUID = /^[0-9a-f-]{36}$/i;

// Mark officers and leads inactive (or active again) for the current quarter only (nothing is planned ahead, and a finished quarter is a record):
// { quarter_id, user_ids: [...], inactive: true | false }
export async function PUT(request: Request) {
  const auth = await authorizeQuarters('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  const quarterId = String(b.quarter_id ?? '');
  const ids: string[] = (Array.isArray(b.user_ids) ? b.user_ids : [b.user_id]).map(String).filter((x: string) => UUID.test(x)).slice(0, 300);
  if (!UUID.test(quarterId) || ids.length === 0 || typeof b.inactive !== 'boolean') return NextResponse.json({ error: 'Pick a quarter and who to change.' }, { status: 400 });
  const quarters = await loadQuarters(auth.svc);
  const q = markableQuarters(quarters, pacificDayKey()).find((x) => x.id === quarterId);
  if (!q) return NextResponse.json({ error: 'Only the current quarter can be changed. Past quarters are a record and future ones start when they begin.' }, { status: 400 });
  const { data: grants } = await auth.svc.from('user_roles').select('user_id, role').in('user_id', ids);
  const rolesOf = new Map<string, { role: string }[]>();
  for (const g of grants ?? []) rolesOf.set(g.user_id as string, [...(rolesOf.get(g.user_id as string) ?? []), { role: g.role as string }]);
  const okIds = ids.filter((id) => canBeInactive(rolesOf.get(id) ?? []));
  if (b.inactive && okIds.length !== ids.length) return NextResponse.json({ error: 'Only officers and leads can be inactive (not exec or admins).' }, { status: 400 });
  if (b.inactive) await auth.svc.from('officer_quarter_status').upsert(okIds.map((user_id) => ({ user_id, quarter_id: quarterId, set_by: auth.user.id })), { onConflict: 'user_id,quarter_id' });
  else await auth.svc.from('officer_quarter_status').delete().eq('quarter_id', quarterId).in('user_id', ids);
  await logAudit(auth.svc, { actorId: auth.user.id, action: b.inactive ? 'inactive' : 'active', entityType: 'quarter status', entityId: quarterId, summary: `${b.inactive ? 'Marked' : 'Brought back'} ${ids.length} ${ids.length === 1 ? 'person' : 'people'} ${b.inactive ? 'inactive for' : 'to active for'} ${quarterName(q)}` });
  const sync = await syncInactive(auth.svc);
  return NextResponse.json({ ok: true, ...sync });
}
