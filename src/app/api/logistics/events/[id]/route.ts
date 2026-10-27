import { NextResponse } from 'next/server';
import { namesOf } from '@/lib/docs/docsServer';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { BORROWED_COLUMNS, DEVICE_COLUMNS, PLAN_COLUMNS, lockedRequestIds, SLOT_COLUMNS, UUID, bookedElsewhere, loadSteps, ownerLabelOf, ownerNames, type BorrowedRow } from '@/lib/logistics/planServer';
import { planConflicts } from '@/lib/logistics/plans';
import type { Device } from '@/lib/logistics/devices';
import { loadPlanPrizes } from '@/lib/logistics/prizeServer';
import { announce, planTopic, whoIs } from '@/lib/logistics/live';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// A whole plan in one go: its stations, its devices (with their details), the steps and which are done, and the things to look at. The event-day screen applies each tap itself
// and only asks for this again when another phone has changed something (see /version).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('request');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: plan } = await auth.svc.from('logistics_plans').select(PLAN_COLUMNS).eq('id', id).maybeSingle();
  if (!plan) return NextResponse.json({ error: 'That plan is gone.' }, { status: 404 });
  // A division account gets only the plan itself (for the Requests page), none of its devices, teams or prizes.
  if (!auth.canView) return NextResponse.json({ plan, canManage: false, requestOnly: true, stations: [], steps: [], prizes: { lines: [], done: [], steps: [] }, lockedRequests: [], items: [], slots: [], borrowed: [], extras: [], done: [], conflicts: [] });
  const prizeData = loadPlanPrizes(auth.svc, id);
  const lockedP = lockedRequestIds(auth.svc, id);   // read alongside the rest
  const [stations, rows, steps, done, borrowedRows, slotRows] = await Promise.all([
    auth.svc.from('logistics_stations').select('id, name, sort, contact, room, prize_only, prize_request_id, prize_target_qty, prize_target_sizes').eq('plan_id', id).order('sort').order('name').limit(500),
    auth.svc.from('logistics_plan_devices').select('device_id, station_id, role, swap_reason, swapped_for_label, games_needed, sort, set_id, request_id, request_item').eq('plan_id', id).limit(5000),
    loadSteps(auth.svc),
    auth.svc.from('logistics_plan_steps').select('device_id, borrowed_id, slot_id, step_id, done_at, done_by').eq('plan_id', id).limit(30000),
    auth.svc.from('logistics_plan_borrowed').select(BORROWED_COLUMNS).eq('plan_id', id).order('tag_key').limit(1000),
    auth.svc.from('logistics_plan_slots').select(SLOT_COLUMNS).eq('plan_id', id).order('sort').limit(3000),
  ]);
  // Devices that have a step but are not in the plan ("not in plan" backups used on the day) come along too.
  const ids = [...new Set([...(rows.data ?? []).map((r) => r.device_id as string), ...(done.data ?? []).map((r) => r.device_id as string | null).filter((x): x is string => !!x)])];
  const { data: devices } = ids.length ? await auth.svc.from('logistics_devices').select(DEVICE_COLUMNS).in('id', ids) : { data: [] };
  const byId = new Map((devices ?? []).map((d) => [d.id as string, d as unknown as Device]));
  const planned = (rows.data ?? []).filter((r) => r.role === 'planned').map((r) => byId.get(r.device_id as string)).filter((d): d is Device => !!d);
  const borrowed = (borrowedRows.data ?? []) as unknown as BorrowedRow[];
  // Three independent reads, made together.
  const [names, doneNames, booked] = await Promise.all([
    ownerNames(auth.svc, borrowed),
    namesOf(auth.svc, (done.data ?? []).map((d) => d.done_by as string | null)),
    bookedElsewhere(auth.svc, plan as { id: string; starts_on: string; ends_on: string }, planned.map((d) => d.id)),
  ]);
  return NextResponse.json({
    plan, canManage: auth.canManage, stations: stations.data ?? [], steps, prizes: await prizeData, lockedRequests: [...(await lockedP)],
    items: (rows.data ?? []).map((r) => ({ ...r, device: byId.get(r.device_id as string) })).filter((r) => r.device),
    slots: slotRows.data ?? [],
    borrowed: borrowed.map((b) => ({ ...b, owner: ownerLabelOf(b, names) })),
    extras: [...new Set((done.data ?? []).map((r) => r.device_id as string | null).filter((x): x is string => !!x))].filter((d) => !(rows.data ?? []).some((r) => r.device_id === d)).map((d) => byId.get(d)).filter(Boolean),
    done: (done.data ?? []).map(({ done_by, ...d }) => ({ ...d, by: doneNames.get(done_by as string) ?? null })),
    conflicts: planConflicts(planned, booked),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('name' in b) { const n = String(b.name ?? '').trim().slice(0, 120); if (!n) return NextResponse.json({ error: 'The plan needs a name.' }, { status: 400 }); patch.name = n; }
  if ('starts_on' in b) { if (!DATE.test(b.starts_on)) return NextResponse.json({ error: 'Pick the first day.' }, { status: 400 }); patch.starts_on = b.starts_on; }
  if ('ends_on' in b) { if (!DATE.test(b.ends_on)) return NextResponse.json({ error: 'Pick the last day.' }, { status: 400 }); patch.ends_on = b.ends_on; }
  if ('status' in b) { if (b.status !== 'draft' && b.status !== 'closed') return NextResponse.json({ error: 'Unknown status.' }, { status: 400 }); patch.status = b.status; }
  if ('notes' in b) patch.notes = String(b.notes ?? '').trim().slice(0, 2000) || null;
  const { data: before } = await auth.svc.from('logistics_plans').select('starts_on, ends_on, name, status').eq('id', id).maybeSingle();
  if (!before) return NextResponse.json({ error: 'That plan is gone.' }, { status: 404 });
  if (((patch.ends_on ?? before.ends_on) as string) < ((patch.starts_on ?? before.starts_on) as string)) return NextResponse.json({ error: 'The last day can’t be before the first.' }, { status: 400 });
  // Closing or reopening an event changes no stock: what was given out left stock as it was counted, and whatever was neither given out nor counted back simply stays in stock. A closed event holds nothing back.
  const { data, error } = await auth.svc.from('logistics_plans').update(patch).eq('id', id).select(PLAN_COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  if (patch.status) await announce(planTopic(id), { k: 'plan', plan: id }, await whoIs(auth.svc, auth.user.id));
  if (patch.status) await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'logistics plan', entityId: id, summary: `${patch.status === 'closed' ? 'Closed' : 'Reopened'} the equipment plan “${data.name}”` });
  return NextResponse.json({ plan: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: p } = await auth.svc.from('logistics_plans').select('name').eq('id', id).maybeSingle();
  if (!p) return NextResponse.json({ ok: true });
  const { error } = await auth.svc.from('logistics_plans').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Couldn’t remove it.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'remove', entityType: 'logistics plan', entityId: id, summary: `Removed the equipment plan “${p.name}”` });
  return NextResponse.json({ ok: true });
}
