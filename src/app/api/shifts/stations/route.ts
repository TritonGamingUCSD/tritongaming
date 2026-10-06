import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import { UUID, authorizeShifts, bad, withDocTitles, STATIONS_CHANNEL, notifyShifts } from '@/lib/shiftsServer';
import { STATION_COLS } from '@/lib/shifts';
import { text, webUrl } from '@/lib/shiftFields';

export const dynamic = 'force-dynamic';

const clean = (v: unknown) => String(v ?? '').trim().slice(0, 60);
const count = (v: unknown, fallback = 1) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 50 ? n : fallback; };

// Exec: the stations (rows of every grid). { name, default_needed } adds one at the bottom.
export async function POST(request: Request) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const name = clean(b.name);
  if (!name) return bad('Give the station a name.');
  const { data: last } = await auth.svc.from('shift_stations').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await auth.svc.from('shift_stations').insert({ name, default_needed: count(b.default_needed), area: text(b.area, 40), sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1 }).select(STATION_COLS).single();
  if (error) return bad(error.code === '23505' ? 'A station with that name already exists.' : 'Couldn’t add the station.', error.code === '23505' ? 409 : 500);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'shift station', entityId: data.id as string, summary: `Added the shift station "${name}"` });
  await notifyShifts(STATIONS_CHANNEL);
  return NextResponse.json({ station: data });
}

// Change a station: { id, name?, default_needed?, category?, team_label? }.
export async function PATCH(request: Request) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Station not found.', 404);
  const patch: Record<string, unknown> = {};
  if ('name' in b) { const n = clean(b.name); if (!n) return bad('Give the station a name.'); patch.name = n; }
  if ('default_needed' in b) patch.default_needed = count(b.default_needed);
  if ('category' in b) { if (b.category !== 'general' && b.category !== 'team') return bad('Pick general or team.'); patch.category = b.category; }
  if ('team_label' in b) patch.team_label = text(b.team_label, 40);
  if ('area' in b) patch.area = text(b.area, 40);
  if ('location' in b) patch.location = text(b.location, 120);
  if ('instructions' in b) patch.instructions = text(b.instructions, 4000);
  if ('link_label' in b) patch.link_label = text(b.link_label, 60);
  if ('link_url' in b) { const u = webUrl(b.link_url); if (u === undefined) return bad('The link must start with https://'); patch.link_url = u; }
  if ('doc_id' in b) {
    const d = b.doc_id ? String(b.doc_id) : null;
    if (d) { if (!UUID.test(d)) return bad('Doc not found.', 404); const { data: doc } = await auth.svc.from('docs').select('id').eq('id', d).maybeSingle(); if (!doc) return bad('Doc not found.', 404); }
    patch.doc_id = d;
  }
  if (Object.keys(patch).length === 0) return bad('Nothing to change.');
  const { data, error } = await auth.svc.from('shift_stations').update(patch).eq('id', id).select(STATION_COLS).maybeSingle();
  if (error) return bad(error.code === '23505' ? 'A station with that name already exists.' : 'Couldn’t save that.', error.code === '23505' ? 409 : 500);
  if (!data) return bad('Station not found.', 404);
  if (['category', 'team_label', 'location', 'instructions', 'doc_id', 'link_url', 'link_label'].some((k) => k in patch)) await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'shift station', entityId: id, summary: `Edited the guide for the shift station "${data.name}"` });
  const [withTitle] = await withDocTitles(auth.svc, [data as never]);
  await notifyShifts(STATIONS_CHANNEL);
  return NextResponse.json({ station: withTitle });
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
  await notifyShifts(STATIONS_CHANNEL);
  return NextResponse.json({ ok: true });
}
