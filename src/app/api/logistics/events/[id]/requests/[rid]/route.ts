import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID, touchPlan } from '@/lib/logistics/planServer';
import { REQUEST_COLUMNS, logisticsTeamIds, requestHref } from '@/lib/logistics/requestServer';
import { canEditRequest, cleanRequestItems, REQUEST_STATUSES, requestSummary, type DeviceItem, type PrizeItem, type RequestKind, type RequestStatus } from '@/lib/logistics/requests';
import { syncPrizeStation, syncRequestRows } from '@/lib/logistics/requestRows';
import { createNotifications } from '@/lib/notifications/notify';
import { logAudit } from '@/lib/notifications/audit';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface Row { allocation_locked?: boolean; id: string; plan_id: string; kind: RequestKind; requester_id: string; division_id: string | null; team: string | null; contact: string | null; items: (DeviceItem | PrizeItem)[]; notes: string | null; status: RequestStatus; response: string | null; planned_by: string | null; planned_at: string | null; created_at: string; updated_at: string }
const text = (v: unknown, n: number) => { const s = String(v ?? '').trim().slice(0, n); return s || null; };

async function known(svc: SupabaseClient) {
  const { data } = await svc.from('logistics_options').select('kind, value').in('kind', ['bundle', 'type', 'prize_size']);
  return { sizes: (data ?? []).filter((o) => o.kind === 'prize_size').map((o) => o.value as string), bundles: (data ?? []).filter((o) => o.kind === 'bundle').map((o) => o.value as string), types: (data ?? []).filter((o) => o.kind === 'type').map((o) => o.value as string) };
}
async function names(svc: SupabaseClient, ids: string[]) {
  const { data } = ids.length ? await svc.from('profiles').select('id, display_name').in('id', ids) : { data: [] };
  return new Map((data ?? []).map((p) => [p.id as string, (p.display_name as string | null) || 'Unnamed']));
}
async function divisionOk(svc: SupabaseClient, v: unknown): Promise<string | null | false> {
  if (typeof v !== 'string' || !UUID.test(v)) return null;
  const { data } = await svc.from('divisions').select('id').eq('id', v).maybeSingle();
  return data ? (data.id as string) : false;
}

// The requests for one event. The logistics team sees all of them; a division account sees its division's and its own; everyone else sees only their own. Also the divisions to pick from.
// One request: change it (PATCH) or remove it (DELETE).
// Change a request. The person who asked can change or correct it until it is planned; the logistics team can change anything and set where it stands (Submitted, Planned, Done,
// Declined) with a note, and the person who asked is told when that changes.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { id, rid } = await params;
  const b = { ...(await request.json().catch(() => ({}))), request_id: rid };
  if (!UUID.test(id) || typeof b.request_id !== 'string' || !UUID.test(b.request_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const [{ data: before }, { data: plan }] = await Promise.all([
    auth.svc.from('logistics_requests').select(REQUEST_COLUMNS).eq('id', b.request_id).eq('plan_id', id).maybeSingle(),
    auth.svc.from('logistics_plans').select('id, name, slug, status').eq('id', id).maybeSingle(),
  ]);
  const r = before as unknown as Row | null;
  if (!r || !plan) return NextResponse.json({ error: 'That request is gone.' }, { status: 404 });
  if (!canEditRequest(auth.canManage)) return NextResponse.json({ error: 'A submitted request can only be changed by the Event Logistics team. Ask them.' }, { status: 403 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  // Lock or unlock this request's allocation (Event Logistics only). While it is locked nothing that would move its rows or prizes can change: what it asks for, its team, being declined, or being removed.
  if ('allocation_locked' in b) {
    if (!auth.canManage || typeof b.allocation_locked !== 'boolean') return NextResponse.json({ error: 'Only the Event Logistics team can lock a request.' }, { status: 403 });
    patch.allocation_locked = b.allocation_locked;
  }
  const frozen = !!r.allocation_locked && b.allocation_locked !== false;
  if (frozen && ('items' in b || 'team' in b || b.status === 'declined')) return NextResponse.json({ error: 'This request’s allocation is locked. Unlock it first.' }, { status: 409 });
  if ('items' in b) { const items = cleanRequestItems(r.kind, b.items, await known(auth.svc)); if ('error' in items) return NextResponse.json({ error: items.error }, { status: 400 }); patch.items = items.items; }
  if ('team' in b) patch.team = text(b.team, 120);
  // The request has one contact: a division lead or an officer or above. Only the Event Logistics team can change who.
  if (typeof b.requester_id === 'string' && UUID.test(b.requester_id) && b.requester_id !== r.requester_id) {
    const { data: eligible } = await auth.svc.from('user_roles').select('user_id').eq('user_id', b.requester_id).in('role', ['officer', 'division', 'lead', 'exec', 'admin']).limit(1);
    if (!eligible?.length) return NextResponse.json({ error: 'Pick a division lead, or an officer or above.' }, { status: 400 });
    patch.requester_id = b.requester_id;
    patch.contact = (await names(auth.svc, [b.requester_id])).get(b.requester_id) ?? null;
  }
  if ('notes' in b) patch.notes = text(b.notes, 2000);
  if ('division_id' in b) { const d = await divisionOk(auth.svc, b.division_id); if (d === false) return NextResponse.json({ error: 'That division is gone.' }, { status: 400 }); patch.division_id = d; }
  let statusChanged = false;
  if (auth.canManage) {
    if ('status' in b) {
      if (!REQUEST_STATUSES.includes(b.status)) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
      statusChanged = b.status !== r.status;
      patch.status = b.status;
      patch.planned_by = b.status === 'submitted' ? null : auth.user.id;
      patch.planned_at = b.status === 'submitted' ? null : new Date().toISOString();
    }
  }
  const { data, error } = await auth.svc.from('logistics_requests').update(patch).eq('id', r.id).select(REQUEST_COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  if (!auth.canManage) {
    const team = (await logisticsTeamIds(auth.svc)).filter((u) => u !== auth.user.id);
    const who = (await names(auth.svc, [auth.user.id])).get(auth.user.id) ?? 'Someone';
    await createNotifications(auth.svc, team.map((user_id) => ({ user_id, type: 'logistics_request', title: `A request for ${plan.name} was changed`, body: `${who}: ${requestSummary(r.kind, data.items as (DeviceItem | PrizeItem)[])}`.slice(0, 240), href: requestHref(plan.slug as string, r.kind) })));
  }
  const sync = !frozen && r.kind === 'devices' && ('items' in b || 'team' in b || 'requester_id' in b || 'division_id' in b || statusChanged) ? await syncRequestRows(auth.svc, data as never) : { kept: 0 };
  if (!frozen && r.kind === 'prizes' && ('items' in b || 'team' in b || statusChanged)) await syncPrizeStation(auth.svc, data as never);
  await touchPlan(auth.svc, id);
  return NextResponse.json({ request: data, kept: sync.kept });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { id, rid } = await params;
  const b = { ...(await request.json().catch(() => ({}))), request_id: rid };
  if (!UUID.test(id) || typeof b.request_id !== 'string' || !UUID.test(b.request_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: r } = await auth.svc.from('logistics_requests').select('id, kind, requester_id, status, allocation_locked').eq('id', b.request_id).eq('plan_id', id).maybeSingle();
  if (!r) return NextResponse.json({ ok: true });
  if (r.allocation_locked) return NextResponse.json({ error: 'This request’s allocation is locked. Unlock it first.' }, { status: 409 });
  if (!canEditRequest(auth.canManage)) return NextResponse.json({ error: 'Only the Event Logistics team can remove a request.' }, { status: 403 });
  if (r.kind === 'devices') {
    await auth.svc.from('logistics_plan_slots').delete().eq('request_id', r.id as string);
    await auth.svc.from('logistics_plan_devices').update({ request_id: null }).eq('request_id', r.id as string);
  }
  if (r.kind === 'prizes') {
    const { data: sts } = await auth.svc.from('logistics_stations').select('id, prize_only').eq('prize_request_id', r.id as string);
    for (const st of sts ?? []) {
      if (st.prize_only) await auth.svc.from('logistics_stations').delete().eq('id', st.id as string);
      else { await auth.svc.from('logistics_plan_prizes').delete().eq('station_id', st.id as string); await auth.svc.from('logistics_stations').update({ prize_request_id: null, prize_target_qty: null, prize_target_sizes: null }).eq('id', st.id as string); }
    }
  }
  await auth.svc.from('logistics_requests').delete().eq('id', r.id as string);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'remove', entityType: 'logistics request', entityId: r.id as string, summary: `Removed a ${r.kind} request` });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true });
}
