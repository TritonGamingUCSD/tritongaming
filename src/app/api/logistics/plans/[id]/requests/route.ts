import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID, touchPlan } from '@/lib/logistics/planServer';
import { REQUEST_COLUMNS, logisticsTeamIds } from '@/lib/logistics/requestServer';
import { canEditRequest, cleanRequestItems, REQUEST_STATUSES, requestSummary, type DeviceItem, type PrizeItem, type RequestKind, type RequestStatus } from '@/lib/logistics/requests';
import { syncPrizePool, syncRequestRows } from '@/lib/logistics/requestRows';
import { createNotifications } from '@/lib/notifications/notify';
import { logAudit } from '@/lib/notifications/audit';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface Row { id: string; plan_id: string; kind: RequestKind; requester_id: string; division_id: string | null; team: string | null; contact: string | null; items: (DeviceItem | PrizeItem)[]; notes: string | null; status: RequestStatus; response: string | null; planned_by: string | null; planned_at: string | null; created_at: string; updated_at: string }
const text = (v: unknown, n: number) => { const s = String(v ?? '').trim().slice(0, n); return s || null; };

async function known(svc: SupabaseClient) {
  const { data } = await svc.from('logistics_options').select('kind, value').in('kind', ['bundle', 'type']);
  return { bundles: (data ?? []).filter((o) => o.kind === 'bundle').map((o) => o.value as string), types: (data ?? []).filter((o) => o.kind === 'type').map((o) => o.value as string) };
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
const href = (slug: string) => `/portal/logistics/${slug}/requests`;

// The requests for one event. The logistics team sees all of them; everyone else sees only their own. Also the divisions to pick from.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  let q = auth.svc.from('logistics_requests').select(REQUEST_COLUMNS).eq('plan_id', id).order('created_at', { ascending: false }).limit(500);
  if (!auth.canManage) q = q.eq('requester_id', auth.user.id);
  const [{ data }, { data: divisions }, { data: mine }] = await Promise.all([q, auth.svc.from('divisions').select('id, name').order('name').limit(100), auth.svc.from('user_roles').select('division_id').eq('user_id', auth.user.id)]);
  const rows = (data ?? []) as unknown as Row[];
  const who = await names(auth.svc, [...new Set(rows.flatMap((r) => [r.requester_id, r.planned_by].filter((x): x is string => !!x)))]);
  const div = new Map((divisions ?? []).map((d) => [d.id as string, d.name as string]));
  const ids = rows.filter((r) => r.kind === 'devices').map((r) => r.id);
  const [{ data: sl }, { data: pd }] = ids.length ? await Promise.all([auth.svc.from('logistics_plan_slots').select('request_id').in('request_id', ids), auth.svc.from('logistics_plan_devices').select('request_id').in('request_id', ids)]) : [{ data: [] }, { data: [] }];
  // Prize requests: how many prizes the pool for each one holds so far, and what they add up to.
  const pids = rows.filter((r) => r.kind === 'prizes').map((r) => r.id);
  const gotPrizes = new Map<string, { qty: number; total: number }>();
  if (pids.length) {
    const { data: pools } = await auth.svc.from('logistics_plan_pools').select('id, request_id').in('request_id', pids);
    const poolIds = (pools ?? []).map((p) => p.id as string);
    const { data: lines } = poolIds.length ? await auth.svc.from('logistics_plan_prizes').select('pool_id, quantity, prize_id').in('pool_id', poolIds) : { data: [] };
    const prizeIds = [...new Set((lines ?? []).map((l) => l.prize_id as string))];
    const { data: prices } = prizeIds.length ? await auth.svc.from('logistics_prizes').select('id, price').in('id', prizeIds) : { data: [] };
    const price = new Map((prices ?? []).map((p) => [p.id as string, Number(p.price ?? 0)]));
    for (const p of pools ?? []) {
      const mine = (lines ?? []).filter((l) => l.pool_id === p.id);
      gotPrizes.set(p.request_id as string, { qty: mine.reduce((n, l) => n + (l.quantity as number), 0), total: Math.round(mine.reduce((n, l) => n + (l.quantity as number) * (price.get(l.prize_id as string) ?? 0), 0) * 100) / 100 });
    }
  }
  const count = (list: { request_id: unknown }[] | null, id: string) => (list ?? []).filter((x) => x.request_id === id).length;
  return NextResponse.json({
    me: auth.user.id, canManage: auth.canManage,
    divisions: divisions ?? [], myDivisionIds: [...new Set((mine ?? []).map((m) => m.division_id as string | null).filter((x): x is string => !!x))],
    requests: rows.map((r) => ({ ...r, filled: count(pd, r.id), rowsTotal: count(pd, r.id) + count(sl, r.id), prizesGot: gotPrizes.get(r.id) ?? { qty: 0, total: 0 }, requester: who.get(r.requester_id) ?? 'Unnamed', division: r.division_id ? div.get(r.division_id) ?? null : null, planner: r.planned_by ? who.get(r.planned_by) ?? null : null })),
  });
}

// Ask for devices or prizes. The logistics team can also write one for somebody else (requester_id). The logistics team is told.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: plan } = await auth.svc.from('logistics_plans').select('id, name, slug, status').eq('id', id).maybeSingle();
  if (!plan) return NextResponse.json({ error: 'That event is gone.' }, { status: 404 });
  if (plan.status === 'closed') return NextResponse.json({ error: 'This event is closed, so it takes no more requests.' }, { status: 409 });
  const kind = b.kind as RequestKind;
  if (kind !== 'devices' && kind !== 'prizes') return NextResponse.json({ error: 'Say whether it is for devices or prizes.' }, { status: 400 });
  const items = cleanRequestItems(kind, b.items, await known(auth.svc));
  if ('error' in items) return NextResponse.json({ error: items.error }, { status: 400 });
  const division = await divisionOk(auth.svc, b.division_id);
  if (division === false) return NextResponse.json({ error: 'That division is gone.' }, { status: 400 });
  const onBehalf = auth.canManage && typeof b.requester_id === 'string' && UUID.test(b.requester_id) ? b.requester_id : auth.user.id;
  const { data, error } = await auth.svc.from('logistics_requests').insert({ plan_id: id, kind, requester_id: onBehalf, division_id: division, team: text(b.team, 120), contact: text(b.contact, 200), items: items.items, notes: text(b.notes, 2000), created_by: auth.user.id }).select(REQUEST_COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t send the request.' }, { status: 500 });
  const who = (await names(auth.svc, [onBehalf, auth.user.id]));
  const text1 = `${who.get(onBehalf) ?? 'Someone'}${onBehalf !== auth.user.id ? ` (entered by ${who.get(auth.user.id) ?? 'logistics'})` : ''}: ${requestSummary(kind, items.items)}${b.team ? ` for ${text(b.team, 120)}` : ''}`;
  const team = (await logisticsTeamIds(auth.svc)).filter((u) => u !== auth.user.id);
  await createNotifications(auth.svc, team.map((user_id) => ({ user_id, type: 'logistics_request', title: `New ${kind === 'devices' ? 'device' : 'prize'} request for ${plan.name}`, body: text1.slice(0, 240), href: href(plan.slug as string) })));
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'logistics request', entityId: data.id as string, summary: `Asked for ${kind} for “${plan.name}”` });
  if (kind === 'devices') await syncRequestRows(auth.svc, data as never);
  else await syncPrizePool(auth.svc, data as never);
  await touchPlan(auth.svc, id);
  return NextResponse.json({ request: data }, { status: 201 });
}

// Change a request. The person who asked can change or correct it until it is planned; the logistics team can change anything and set where it stands (Submitted, Planned, Done,
// Declined) with a note, and the person who asked is told when that changes.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.request_id !== 'string' || !UUID.test(b.request_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const [{ data: before }, { data: plan }] = await Promise.all([
    auth.svc.from('logistics_requests').select(REQUEST_COLUMNS).eq('id', b.request_id).eq('plan_id', id).maybeSingle(),
    auth.svc.from('logistics_plans').select('id, name, slug, status').eq('id', id).maybeSingle(),
  ]);
  const r = before as unknown as Row | null;
  if (!r || !plan) return NextResponse.json({ error: 'That request is gone.' }, { status: 404 });
  if (!canEditRequest(r, auth.user.id, auth.canManage)) return NextResponse.json({ error: r.requester_id === auth.user.id ? 'The logistics team has already planned this one, so it can’t be changed. Ask them.' : 'This isn’t your request.' }, { status: 403 });
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('items' in b) { const items = cleanRequestItems(r.kind, b.items, await known(auth.svc)); if ('error' in items) return NextResponse.json({ error: items.error }, { status: 400 }); patch.items = items.items; }
  if ('team' in b) patch.team = text(b.team, 120);
  if ('contact' in b) patch.contact = text(b.contact, 200);
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
    await createNotifications(auth.svc, team.map((user_id) => ({ user_id, type: 'logistics_request', title: `A request for ${plan.name} was changed`, body: `${who}: ${requestSummary(r.kind, data.items as (DeviceItem | PrizeItem)[])}`.slice(0, 240), href: href(plan.slug as string) })));
  }
  const sync = r.kind === 'devices' && ('items' in b || 'team' in b || 'contact' in b || 'division_id' in b || statusChanged) ? await syncRequestRows(auth.svc, data as never) : { kept: 0 };
  if (r.kind === 'prizes' && ('items' in b || 'team' in b || statusChanged)) await syncPrizePool(auth.svc, data as never);
  await touchPlan(auth.svc, id);
  return NextResponse.json({ request: data, kept: sync.kept });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!UUID.test(id) || typeof b.request_id !== 'string' || !UUID.test(b.request_id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: r } = await auth.svc.from('logistics_requests').select('id, kind, requester_id, status').eq('id', b.request_id).eq('plan_id', id).maybeSingle();
  if (!r) return NextResponse.json({ ok: true });
  if (!canEditRequest(r as { requester_id: string; status: RequestStatus }, auth.user.id, auth.canManage)) return NextResponse.json({ error: 'You can only take back your own request before it is planned.' }, { status: 403 });
  if (r.kind === 'devices') {
    await auth.svc.from('logistics_plan_slots').delete().eq('request_id', r.id as string);
    await auth.svc.from('logistics_plan_devices').update({ request_id: null }).eq('request_id', r.id as string);
  }
  if (r.kind === 'prizes') await auth.svc.from('logistics_plan_pools').delete().eq('request_id', r.id as string);
  await auth.svc.from('logistics_requests').delete().eq('id', r.id as string);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'remove', entityType: 'logistics request', entityId: r.id as string, summary: `Removed a ${r.kind} request` });
  await touchPlan(auth.svc, id);
  return NextResponse.json({ ok: true });
}
