import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { UUID, touchPlan } from '@/lib/logistics/planServer';
import { REQUEST_COLUMNS, logisticsTeamIds, requestHref } from '@/lib/logistics/requestServer';
import { cleanRequestItems, requestSummary, type DeviceItem, type PrizeItem, type RequestKind, type RequestStatus } from '@/lib/logistics/requests';
import { syncPrizeStation, syncRequestRows } from '@/lib/logistics/requestRows';
import { createNotifications } from '@/lib/notifications/notify';
import { logAudit } from '@/lib/notifications/audit';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface Row {
  allocation_locked?: boolean;
  id: string;
  plan_id: string;
  kind: RequestKind;
  requester_id: string;
  division_id: string | null;
  team: string | null;
  contact: string | null;
  items: (DeviceItem | PrizeItem)[];
  notes: string | null;
  status: RequestStatus;
  response: string | null;
  planned_by: string | null;
  planned_at: string | null;
  created_at: string;
  updated_at: string;
}
const text = (v: unknown, n: number) => {
  const s = String(v ?? '')
    .trim()
    .slice(0, n);
  return s || null;
};

async function known(svc: SupabaseClient) {
  const { data } = await svc.from('logistics_options').select('kind, value').in('kind', ['bundle', 'type', 'prize_size']);
  return {
    sizes: (data ?? []).filter((o) => o.kind === 'prize_size').map((o) => o.value as string),
    bundles: (data ?? []).filter((o) => o.kind === 'bundle').map((o) => o.value as string),
    types: (data ?? []).filter((o) => o.kind === 'type').map((o) => o.value as string),
  };
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
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('request');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  let q = auth.svc.from('logistics_requests').select(REQUEST_COLUMNS).eq('plan_id', id).order('created_at', { ascending: false }).limit(500);
  if (!auth.canManage) {
    const mine = (auth.roles ?? []).filter((r) => r.role === 'division' && r.division_id).map((r) => r.division_id as string);
    q = !auth.canView && mine.length ? q.or(`requester_id.eq.${auth.user.id},division_id.in.(${mine.join(',')})`) : q.eq('requester_id', auth.user.id);
  }
  const [{ data }, { data: divisions }, { data: mine }] = await Promise.all([
    q,
    auth.svc.from('divisions').select('id, name').order('name').limit(100),
    auth.svc.from('user_roles').select('division_id').eq('user_id', auth.user.id),
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const who = await names(auth.svc, [...new Set(rows.flatMap((r) => [r.requester_id, r.planned_by].filter((x): x is string => !!x)))]);
  const div = new Map((divisions ?? []).map((d) => [d.id as string, d.name as string]));
  const ids = rows.filter((r) => r.kind === 'devices').map((r) => r.id);
  const [{ data: sl }, { data: pd }, { data: pb }] = ids.length
    ? await Promise.all([
        auth.svc.from('logistics_plan_slots').select('request_id, type').in('request_id', ids),
        auth.svc.from('logistics_plan_devices').select('request_id').in('request_id', ids),
        auth.svc.from('logistics_plan_borrowed').select('request_id').in('request_id', ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]; // a loaner fills a row too
  // Prize requests: how many prizes the station for each one holds so far.
  const pids = rows.filter((r) => r.kind === 'prizes').map((r) => r.id);
  const gotPrizes = new Map<string, { qty: number }>();
  if (pids.length) {
    const { data: sts } = await auth.svc.from('logistics_stations').select('id, prize_request_id').in('prize_request_id', pids);
    const stIds = (sts ?? []).map((p) => p.id as string);
    const { data: lines } = stIds.length ? await auth.svc.from('logistics_plan_prizes').select('station_id, quantity').in('station_id', stIds) : { data: [] };
    for (const p of sts ?? [])
      gotPrizes.set(p.prize_request_id as string, { qty: (lines ?? []).filter((l) => l.station_id === p.id).reduce((n, l) => n + (l.quantity as number), 0) });
  }
  // A counted type (a mousepad, a cable) never gets a device of its own, so its rows count as filled.
  const { data: countedTypes } = await auth.svc.from('logistics_options').select('value').eq('kind', 'type').eq('meta->>counted', 'true');
  const countedSet = new Set((countedTypes ?? []).map((c) => String(c.value).toLowerCase()));
  const open = (sl ?? []).filter((s) => !countedSet.has(String(s.type).toLowerCase()));
  const count = (list: { request_id: unknown }[] | null, id: string) => (list ?? []).filter((x) => x.request_id === id).length;
  return NextResponse.json({
    me: auth.user.id,
    canManage: auth.canManage,
    divisions: divisions ?? [],
    myDivisionIds: [...new Set((mine ?? []).map((m) => m.division_id as string | null).filter((x): x is string => !!x))],
    requests: rows.map((r) => ({
      ...r,
      filled: count(pd, r.id) + count(pb, r.id) + count(sl, r.id) - count(open, r.id),
      rowsTotal: count(pd, r.id) + count(pb, r.id) + count(sl, r.id),
      prizesGot: gotPrizes.get(r.id) ?? { qty: 0 },
      requester: who.get(r.requester_id) ?? 'Unnamed',
      division: r.division_id ? (div.get(r.division_id) ?? null) : null,
      planner: r.planned_by ? (who.get(r.planned_by) ?? null) : null,
    })),
  });
}

// Ask for devices or prizes. The logistics team can also write one for somebody else (requester_id). The logistics team is told.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('request');
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
  if (kind === 'prizes' && items.items.length === 0 && !text(b.team, 120))
    return NextResponse.json({ error: 'With no amount, say which team the prizes are for.' }, { status: 400 });
  const division = await divisionOk(auth.svc, b.division_id);
  if (division === false) return NextResponse.json({ error: 'That division is gone.' }, { status: 400 });
  const onBehalf = auth.canManage && typeof b.requester_id === 'string' && UUID.test(b.requester_id) ? b.requester_id : auth.user.id;
  const { data, error } = await auth.svc
    .from('logistics_requests')
    .insert({
      plan_id: id,
      kind,
      requester_id: onBehalf,
      division_id: division,
      team: text(b.team, 120),
      contact: (await names(auth.svc, [onBehalf])).get(onBehalf) ?? null,
      items: items.items,
      notes: text(b.notes, 2000),
      created_by: auth.user.id,
    })
    .select(REQUEST_COLUMNS)
    .single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t send the request.' }, { status: 500 });
  const who = await names(auth.svc, [onBehalf, auth.user.id]);
  const text1 = `${who.get(onBehalf) ?? 'Someone'}${onBehalf !== auth.user.id ? ` (entered by ${who.get(auth.user.id) ?? 'logistics'})` : ''}: ${requestSummary(kind, items.items)}${b.team ? ` for ${text(b.team, 120)}` : ''}`;
  const team = (await logisticsTeamIds(auth.svc)).filter((u) => u !== auth.user.id);
  await createNotifications(
    auth.svc,
    team.map((user_id) => ({
      user_id,
      type: 'logistics_request',
      title: `New ${kind === 'devices' ? 'device' : 'prize'} request for ${plan.name}`,
      body: text1.slice(0, 240),
      href: requestHref(plan.slug as string, kind),
    })),
  );
  await logAudit(auth.svc, {
    actorId: auth.user.id,
    action: 'create',
    entityType: 'logistics request',
    entityId: data.id as string,
    summary: `Asked for ${kind} for “${plan.name}”`,
  });
  if (kind === 'devices') await syncRequestRows(auth.svc, data as never);
  else await syncPrizeStation(auth.svc, data as never);
  await touchPlan(auth.svc, id);
  return NextResponse.json({ request: data }, { status: 201 });
}
