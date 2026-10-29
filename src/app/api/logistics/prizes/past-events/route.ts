import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { announce, stockTopic, whoIs } from '@/lib/logistics/live';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

// Prizes that say nothing about the event they were received for, with a guess from the records: the event where the prize was first put on a station (earliest event by date; a prize first
// added while an event was open counts too through its history). The page lets a person look at the guesses and keep the ones that are right.
export async function GET() {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { data: blank } = await auth.svc.from('logistics_prizes').select('id, name, sponsor_id').is('from_event', null).limit(5000);
  const ids = (blank ?? []).map((p) => p.id as string);
  if (!ids.length) return NextResponse.json({ suggestions: [] });
  const [{ data: lines }, { data: log }, { data: plans }] = await Promise.all([
    auth.svc.from('logistics_plan_prizes').select('prize_id, plan_id').in('prize_id', ids).limit(30000),
    auth.svc.from('logistics_prize_log').select('prize_id, plan_id, plan_name, at').in('prize_id', ids).not('plan_name', 'is', null).order('at').limit(30000),
    auth.svc.from('logistics_plans').select('id, name, starts_on').limit(1000),
  ]);
  const plan = new Map((plans ?? []).map((p) => [p.id as string, { name: p.name as string, on: p.starts_on as string }]));
  const best = new Map<string, { plan_id: string | null; name: string; on: string; why: string }>();
  for (const l of lines ?? []) {
    const p = plan.get(l.plan_id as string);
    if (!p) continue;
    const cur = best.get(l.prize_id as string);
    if (!cur || p.on < cur.on) best.set(l.prize_id as string, { plan_id: l.plan_id as string, name: p.name, on: p.on, why: 'first put on a station there' });
  }
  for (const e of log ?? []) {
    // a prize that was on a station but is no longer: its history still names the event
    if (best.has(e.prize_id as string)) continue;
    best.set(e.prize_id as string, {
      plan_id: (e.plan_id as string | null) ?? null,
      name: e.plan_name as string,
      on: String(e.at).slice(0, 10),
      why: 'first used there, from its history',
    });
  }
  const { data: sponsors } = await auth.svc.from('logistics_sponsors').select('id, name');
  const sponsor = new Map((sponsors ?? []).map((s) => [s.id as string, s.name as string]));
  return NextResponse.json({
    suggestions: (blank ?? []).flatMap((p) => {
      const b = best.get(p.id as string);
      return b
        ? [
            {
              prize_id: p.id as string,
              name: p.name as string,
              sponsor: p.sponsor_id ? (sponsor.get(p.sponsor_id as string) ?? null) : null,
              event: b.name,
              plan_id: b.plan_id,
              on: b.on,
              why: b.why,
            },
          ]
        : [];
    }),
  });
}

// Keeps the guesses that were ticked: sets "from event" (and the event's link while it exists) on those prizes, only where it is still blank.
export async function POST(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 2000) as { prize_id?: unknown; event?: unknown; plan_id?: unknown }[];
  let done = 0;
  for (const it of items) {
    const id = typeof it.prize_id === 'string' && /^[0-9a-f-]{36}$/i.test(it.prize_id) ? it.prize_id : null;
    const event = typeof it.event === 'string' ? it.event.trim().slice(0, 120) : '';
    if (!id || !event) continue;
    const plan = typeof it.plan_id === 'string' && /^[0-9a-f-]{36}$/i.test(it.plan_id) ? it.plan_id : null;
    const { data } = await auth.svc
      .from('logistics_prizes')
      .update({ from_event: event, from_plan_id: plan, updated_at: new Date().toISOString(), updated_by: auth.user.id })
      .eq('id', id)
      .is('from_event', null)
      .select('id');
    if (data?.length) done++;
  }
  if (done) {
    await logAudit(auth.svc, {
      actorId: auth.user.id,
      action: 'update',
      entityType: 'logistics prize',
      entityId: 'many',
      summary: `Filled in the event ${done} ${done === 1 ? 'prize was' : 'prizes were'} received for, from past records`,
    });
    await announce(stockTopic(), { k: 'prizes' }, await whoIs(auth.svc, auth.user.id));
  }
  return NextResponse.json({ updated: done });
}
