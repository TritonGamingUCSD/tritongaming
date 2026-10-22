import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { PLAN_COLUMNS, UUID, dayOf, pacificToday } from '@/lib/logistics/planServer';
import { planSlug, RESERVED_SLUGS } from '@/lib/logistics/plans';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// The plans (newest first, with how many devices each has), and with ?events=1 the upcoming portal events to attach a plan to (read only; fetched only when the picker opens).
export async function GET(request: Request) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const params = new URL(request.url).searchParams;
  if (params.get('events')) {
    const today = pacificToday();
    const past = params.get('past') === '1';
    let q = auth.svc.from('events').select('id, title, start_date, end_date').order('start_date', { ascending: !past }).limit(60);
    q = past ? q.lt('start_date', new Date(`${today}T00:00:00-08:00`).toISOString()) : q.gte('end_date', new Date(`${today}T00:00:00-08:00`).toISOString());
    const { data } = await q;
    return NextResponse.json({ events: (data ?? []).map((e) => ({ id: e.id as string, title: e.title as string, starts_on: dayOf(e.start_date as string), ends_on: dayOf((e.end_date as string | null) ?? (e.start_date as string)) })) });
  }
  const { data: plans } = await auth.svc.from('logistics_plans').select(PLAN_COLUMNS).order('starts_on', { ascending: false }).limit(200);
  const ids = (plans ?? []).map((p) => p.id as string);
  const counts = new Map<string, number>();   // device rows in all
  const empty = new Map<string, number>();    // of them, still waiting for a device
  const teams = new Map<string, number>();
  const asked = new Map<string, { all: number; fresh: number }>();
  const prizes = new Map<string, { qty: number; total: number }>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  if (ids.length) {
    const [{ data: rows }, { data: bor }, { data: sl }, { data: sts }, { data: reqs }, { data: lines }] = await Promise.all([
      auth.svc.from('logistics_plan_devices').select('plan_id').in('plan_id', ids).eq('role', 'planned').limit(20000),
      auth.svc.from('logistics_plan_borrowed').select('plan_id').in('plan_id', ids).eq('role', 'planned').limit(20000),
      auth.svc.from('logistics_plan_slots').select('plan_id').in('plan_id', ids).limit(20000),
      auth.svc.from('logistics_stations').select('plan_id').in('plan_id', ids).limit(5000),
      auth.svc.from('logistics_requests').select('plan_id, status').in('plan_id', ids).neq('status', 'declined').limit(5000),
      auth.svc.from('logistics_plan_prizes').select('plan_id, quantity, prize_id').in('plan_id', ids).limit(20000),
    ]);
    for (const r of [...(rows ?? []), ...(bor ?? []), ...(sl ?? [])]) bump(counts, r.plan_id as string);
    for (const r of sl ?? []) bump(empty, r.plan_id as string);
    for (const r of sts ?? []) bump(teams, r.plan_id as string);
    for (const r of reqs ?? []) { const e = asked.get(r.plan_id as string) ?? { all: 0, fresh: 0 }; e.all++; if (r.status === 'submitted') e.fresh++; asked.set(r.plan_id as string, e); }
    const prizeIds = [...new Set((lines ?? []).map((l) => l.prize_id as string))];
    const { data: prices } = prizeIds.length ? await auth.svc.from('logistics_prizes').select('id, price').in('id', prizeIds) : { data: [] };
    const price = new Map((prices ?? []).map((x) => [x.id as string, Number(x.price ?? 0)]));
    for (const l of lines ?? []) { const e = prizes.get(l.plan_id as string) ?? { qty: 0, total: 0 }; e.qty += l.quantity as number; e.total += (l.quantity as number) * (price.get(l.prize_id as string) ?? 0); prizes.set(l.plan_id as string, e); }
  }
  return NextResponse.json({ plans: (plans ?? []).map((p) => { const id = p.id as string, pz = prizes.get(id); return { ...p, devices: counts.get(id) ?? 0, empty: empty.get(id) ?? 0, teams: teams.get(id) ?? 0, requests: asked.get(id)?.all ?? 0, newRequests: asked.get(id)?.fresh ?? 0, prizes: pz?.qty ?? 0, prizeValue: Math.round((pz?.total ?? 0) * 100) / 100 }; }), today: pacificToday() });
}

// Make a plan for a portal event (name and dates come from the event unless given) or a Logistics-only event (a name and dates).
export async function POST(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({}));
  let name = String(b.name ?? '').trim().slice(0, 120);
  let starts = String(b.starts_on ?? ''), ends = String(b.ends_on ?? b.starts_on ?? '');
  let eventId: string | null = null;
  let eventSlug: string | null = null;
  if (b.event_id) {
    if (typeof b.event_id !== 'string' || !UUID.test(b.event_id)) return NextResponse.json({ error: 'Pick an event from the list.' }, { status: 400 });
    const { data: ev } = await auth.svc.from('events').select('id, title, slug, start_date, end_date').eq('id', b.event_id).maybeSingle();
    if (!ev) return NextResponse.json({ error: 'That event no longer exists.' }, { status: 404 });
    eventId = ev.id as string;
    eventSlug = (ev.slug as string | null) ?? null;
    name ||= ev.title as string;
    starts = DATE.test(starts) ? starts : dayOf(ev.start_date as string)!;
    ends = DATE.test(ends) ? ends : dayOf((ev.end_date as string | null) ?? (ev.start_date as string))!;
  }
  if (!name) return NextResponse.json({ error: 'Give the plan a name.' }, { status: 400 });
  if (!DATE.test(starts) || !DATE.test(ends)) return NextResponse.json({ error: 'Pick the dates.' }, { status: 400 });
  if (ends < starts) return NextResponse.json({ error: 'The last day can’t be before the first.' }, { status: 400 });
  // The address name: a plan for a portal event uses that event's slug (which is itself never changed); otherwise it is made once from the name, made unique with the year (and a number if it still clashes), and never changed afterwards, even when the plan is renamed.
  const base = eventSlug || planSlug(name);
  const { data: taken } = await auth.svc.from('logistics_plans').select('slug').like('slug', `${base}%`).limit(200);
  const used = new Set((taken ?? []).map((r) => r.slug as string));
  let slug = base;
  if (used.has(slug) || RESERVED_SLUGS.includes(slug)) slug = `${base}-${starts.slice(0, 4)}`;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${starts.slice(0, 4)}-${n}`;
  const { data, error } = await auth.svc.from('logistics_plans').insert({ name, slug, event_id: eventId, starts_on: starts, ends_on: ends, notes: String(b.notes ?? '').trim().slice(0, 2000) || null, created_by: auth.user.id }).select(PLAN_COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t make the plan.' }, { status: 500 });
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'logistics plan', entityId: data.id as string, summary: `Made the equipment plan “${name}” (${starts}${ends !== starts ? ` to ${ends}` : ''})` });
  return NextResponse.json({ plan: { ...data, devices: 0 } }, { status: 201 });
}
