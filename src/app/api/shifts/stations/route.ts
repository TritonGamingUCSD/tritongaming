import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { UUID, authorizeShifts, bad } from '@/lib/shiftsServer';

export const dynamic = 'force-dynamic';

const clean = (v: unknown) => String(v ?? '').trim().slice(0, 60);
const brief = (v: unknown) => { const t = String(v ?? '').trim().slice(0, 240); return t || null; };
const count = (v: unknown, fallback = 1) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 50 ? n : fallback; };

// Exec: the stations (rows of every grid). { name, default_needed } adds one at the bottom.
export async function POST(request: Request) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const name = clean(b.name);
  if (!name) return bad('Give the station a name.');
  const { data: last } = await auth.svc.from('shift_stations').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await auth.svc.from('shift_stations').insert({ name, default_needed: count(b.default_needed), description: brief(b.description), sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1 }).select('id, name, default_needed, sort_order, description').single();
  if (error) return bad(error.code === '23505' ? 'A station with that name already exists.' : 'Couldn’t add the station.', error.code === '23505' ? 409 : 500);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'shift station', entityId: data.id as string, summary: `Added the shift station "${name}"` });
  return NextResponse.json({ station: data });
}

// Change a station: { id, name?, default_needed?, description? }.
export async function PATCH(request: Request) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Station not found.', 404);
  const patch: Record<string, unknown> = {};
  if ('name' in b) { const n = clean(b.name); if (!n) return bad('Give the station a name.'); patch.name = n; }
  if ('default_needed' in b) patch.default_needed = count(b.default_needed);
  if ('description' in b) patch.description = brief(b.description);
  if (Object.keys(patch).length === 0) return bad('Nothing to change.');
  const { data, error } = await auth.svc.from('shift_stations').update(patch).eq('id', id).select('id, name, default_needed, sort_order, description').maybeSingle();
  if (error) return bad(error.code === '23505' ? 'A station with that name already exists.' : 'Couldn’t save that.', error.code === '23505' ? 409 : 500);
  if (!data) return bad('Station not found.', 404);
  return NextResponse.json({ station: data });
}

// Remove a station (its signups and overrides go with it): { id }.
export async function DELETE(request: Request) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Station not found.', 404);
  const { data: st } = await auth.svc.from('shift_stations').select('name').eq('id', id).maybeSingle();
  await auth.svc.from('shift_stations').delete().eq('id', id);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'shift station', entityId: id, summary: `Removed the shift station "${st?.name ?? ''}"` });
  return NextResponse.json({ ok: true });
}
