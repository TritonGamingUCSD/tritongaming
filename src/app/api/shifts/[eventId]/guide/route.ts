import { NextResponse } from 'next/server';
import { logAudit } from '@/lib/notifications/audit';
import { UUID, authorizeShifts, bad, notifyShifts } from '@/lib/shifts/shiftsServer';
import { parseChecklist, text, webUrl } from '@/lib/shifts/shiftFields';

export const dynamic = 'force-dynamic';

// Exec: what is different at one station for this event: { station_id, location?, notes?, doc_id?, link_url?, link_label? }. Blank clears a field (the station's own is used).
export async function POST(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const auth = await authorizeShifts('manage');
  if ('error' in auth) return auth.error;
  const { eventId } = await params;
  const b = await request.json().catch(() => ({}));
  const stationId = String(b.station_id ?? '');
  if (!UUID.test(eventId) || !UUID.test(stationId)) return bad('Station not found.', 404);
  const url = webUrl(b.link_url);
  if (url === undefined) return bad('The link must start with https://');
  const docId: string | null = b.doc_id ? String(b.doc_id) : null;
  if (docId) { const { data: d } = UUID.test(docId) ? await auth.svc.from('docs').select('id').eq('id', docId).maybeSingle() : { data: null }; if (!d) return bad('That doc no longer exists.', 404); }
  const [{ data: st }, { data: ev }] = await Promise.all([
    auth.svc.from('shift_stations').select('name').eq('id', stationId).maybeSingle(),
    auth.svc.from('events').select('title').eq('id', eventId).maybeSingle(),
  ]);
  if (!st || !ev) return bad('Station not found.', 404);
  const row = { event_id: eventId, station_id: stationId, location: text(b.location, 120), notes: text(b.notes, 4000), doc_id: docId, link_url: url, link_label: text(b.link_label, 60) };
  const empty = !row.location && !row.notes && !row.doc_id && !row.link_url;
  const { error } = empty
    ? await auth.svc.from('shift_event_guides').delete().eq('event_id', eventId).eq('station_id', stationId)
    : await auth.svc.from('shift_event_guides').upsert(row);
  if (error) return bad('Couldn’t save that.', 500);
  // The checklist: one item per line. Items that keep their wording keep their ticks; removed ones go; new ones are added.
  if (typeof b.checklist === 'string') {
    const lines = parseChecklist(b.checklist);
    const { data: have } = await auth.svc.from('shift_checklist_items').select('id, label').eq('event_id', eventId).eq('station_id', stationId);
    const byLabel = new Map((have ?? []).map((h) => [h.label as string, h.id as string]));
    const gone = (have ?? []).filter((h) => !lines.includes(h.label as string)).map((h) => h.id as string);
    if (gone.length) await auth.svc.from('shift_checklist_items').delete().in('id', gone);
    const fresh = lines.map((label, i) => ({ label, i })).filter((l) => !byLabel.has(l.label));
    if (fresh.length) await auth.svc.from('shift_checklist_items').insert(fresh.map((l) => ({ event_id: eventId, station_id: stationId, label: l.label, sort_order: l.i })));
    for (const [i, label] of lines.entries()) { const id = byLabel.get(label); if (id) await auth.svc.from('shift_checklist_items').update({ sort_order: i }).eq('id', id); }
  }
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'shift station', entityId: stationId, summary: `Edited the "${st.name}" shift guide for "${ev.title}"` });
  await notifyShifts(eventId);
  return NextResponse.json({ ok: true });
}
