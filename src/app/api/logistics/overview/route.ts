import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { pacificToday } from '@/lib/logistics/planServer';
import { countAt, ensureLoose, loadPlanPrizes, loadPrizeTotals, stepKinds } from '@/lib/logistics/prizeServer';
import { isLoose, lineNumbers, prizeLeft } from '@/lib/logistics/prizes';

export const dynamic = 'force-dynamic';

// The Logistics overview (every officer can look): the event to look at first (today's, else the next one, else the latest still open) with its numbers, what needs attention, the Staffles that are
// running and the latest changes. The stock and the devices at a glance are worked out on the screen from the lists it already has.
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export async function GET() {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const svc = auth.svc;
  await ensureLoose(svc);
  const today = pacificToday();
  const { data: open } = await svc.from('logistics_plans').select('id, slug, name, starts_on, ends_on').eq('status', 'draft').order('starts_on').limit(100);
  const plans = open ?? [];
  const focusRow = plans.find((p) => p.starts_on <= today && today <= p.ends_on) ?? plans.find((p) => p.starts_on > today) ?? plans[plans.length - 1] ?? null;

  const fixes: { sev: 'bad' | 'warn'; text: string; href: string }[] = [];
  // An event that is over but not closed still holds its prizes (they count as planned until it is closed), so say so.
  for (const p of plans)
    if ((p.ends_on as string) < today)
      fixes.push({ sev: 'warn', text: `${p.name} is over but still open, so its prizes still count as planned. Close it when it is done.`, href: `/portal/logistics/${p.slug}` });
  const [{ data: prizes }, totals] = await Promise.all([svc.from('logistics_prizes').select('id, name, quantity, size, stock_level, in_hand').limit(2000), loadPrizeTotals(svc)]);
  for (const p of prizes ?? []) {
    const t = totals.get(p.id as string) ?? { allocated: 0 };
    const left = prizeLeft(p as { quantity: number; size: string | null; stock_level: string }, t);
    if (left < 0) fixes.push({ sev: 'bad', text: `${p.name}: ${-left} more promised than there are`, href: '/portal/logistics/prizing?view=sheet' });
    else if (!p.in_hand && t.allocated + (t.staffle ?? 0) > 0)
      fixes.push({ sev: 'warn', text: `${p.name} is planned but not here yet`, href: '/portal/logistics/prizing?view=sheet' });
  }

  let focus: null | { id: string; slug: string; name: string; starts_on: string; ends_on: string; daysAway: number; stats: Record<string, number> } = null;
  if (focusRow) {
    const pid = focusRow.id as string;
    const [stations, slots, requests, prizeData] = await Promise.all([
      svc.from('logistics_stations').select('id, name, prize_only').eq('plan_id', pid).limit(500),
      svc.from('logistics_plan_slots').select('id', { count: 'exact', head: true }).eq('plan_id', pid),
      svc.from('logistics_requests').select('id, status').eq('plan_id', pid).neq('status', 'declined').limit(2000),
      loadPlanPrizes(svc, pid),
    ]);
    const { gives, back } = stepKinds(prizeData.steps);
    let planned = 0,
      given = 0,
      returned = 0,
      held = 0;
    for (const l of prizeData.lines) {
      if (isLoose(l.prize)) continue; // free merch is not counted
      const n = lineNumbers(l.quantity, countAt(prizeData.done, l.id, gives), countAt(prizeData.done, l.id, back));
      planned += n.planned;
      given += n.given;
      returned += n.back;
      held += n.held;
    }
    const withLines = new Set(prizeData.lines.map((l) => l.station_id));
    const bare = (stations.data ?? []).filter((s) => !withLines.has(s.id as string));
    const fresh = (requests.data ?? []).filter((r) => r.status === 'submitted').length;
    const base = `/portal/logistics/${focusRow.slug}`;
    if (fresh) fixes.unshift({ sev: 'warn', text: `${fresh} new ${fresh === 1 ? 'request' : 'requests'} for ${focusRow.name} waiting`, href: `${base}/requests` });
    if ((slots.count ?? 0) > 0)
      fixes.unshift({ sev: 'warn', text: `${slots.count} ${slots.count === 1 ? 'device' : 'devices'} for ${focusRow.name} still need an ID`, href: `${base}/devices` });
    for (const s of bare.slice(0, 6)) fixes.push({ sev: 'warn', text: `${s.name} (${focusRow.name}) has no prizes yet`, href: `${base}/prizing` });
    focus = {
      id: pid,
      slug: focusRow.slug as string,
      name: focusRow.name as string,
      starts_on: focusRow.starts_on as string,
      ends_on: focusRow.ends_on as string,
      daysAway: days(today, focusRow.starts_on as string),
      stats: {
        stations: stations.data?.length ?? 0,
        stationsBare: bare.length,
        devicesEmpty: slots.count ?? 0,
        requests: requests.data?.length ?? 0,
        newRequests: fresh,
        prizeLines: prizeData.lines.length,
        planned,
        given,
        back: returned,
        held,
      },
    };
  }

  const [{ data: staffles }, { data: audit }] = await Promise.all([
    svc.from('staffles').select('slug, name, status').in('status', ['draft', 'open', 'closed', 'drawn']).order('created_at', { ascending: false }).limit(5),
    svc.from('audit_log').select('created_at, actor_name, summary').or('entity_type.ilike.logistics%,entity_type.eq.staffle').order('created_at', { ascending: false }).limit(10),
  ]);
  return NextResponse.json({
    today,
    focus,
    fixes: fixes.slice(0, 14),
    moreFixes: Math.max(0, fixes.length - 14),
    staffles: (staffles ?? []).map((s) => ({ slug: s.slug as string, name: s.name as string, state: s.status as string })),
    recent: (audit ?? []).map((a) => ({ at: a.created_at as string, who: (a.actor_name as string | null) ?? null, text: a.summary as string })),
  });
}
