import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { PRIZE_COLUMNS, ensureLoose, loadPrizeTotals, logPrize } from '@/lib/logistics/prizeServer';
import { cleanPrize, prizeLeft } from '@/lib/logistics/prizes';
import { announce, stockTopic, whoIs } from '@/lib/logistics/live';
import { logAudit } from '@/lib/notifications/audit';

export const dynamic = 'force-dynamic';

// The prize inventory (every officer can look): each prize with how many are on hand, how many open events have promised (not yet given out), and how many are left to promise. Read when the
// Prizing page opens, not with the rest of Logistics.
export async function GET() {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  await ensureLoose(auth.svc);
  const [{ data: prizes, error }, totals] = await Promise.all([auth.svc.from('logistics_prizes').select(PRIZE_COLUMNS).order('name').limit(5000), loadPrizeTotals(auth.svc)]);
  if (error) return NextResponse.json({ error: 'Couldn’t load the prizes.' }, { status: 500 });
  // Where each prize has been used: the events whose stations it was put on (open or closed), by name.
  const [{ data: used }, { data: plans }] = await Promise.all([
    auth.svc.from('logistics_plan_prizes').select('prize_id, plan_id').limit(30000),
    auth.svc.from('logistics_plans').select('id, name, starts_on').order('starts_on').limit(500),
  ]);
  const planName = new Map((plans ?? []).map((p) => [p.id as string, p.name as string]));
  const usedAt = new Map<string, string[]>();
  for (const u of used ?? []) {
    const n = planName.get(u.plan_id as string);
    if (n && !(usedAt.get(u.prize_id as string) ?? []).includes(n)) usedAt.set(u.prize_id as string, [...(usedAt.get(u.prize_id as string) ?? []), n]);
  }
  return NextResponse.json({
    channel: stockTopic(), // where changes to the stock are announced (the page listens)
    prizes: (prizes ?? []).map((p) => {
      const t = totals.get(p.id as string) ?? { allocated: 0 };
      return {
        ...p,
        price: p.price === null ? null : Number(p.price),
        allocated: t.allocated,
        left: prizeLeft(p as { quantity: number }, t),
        used_at: usedAt.get(p.id as string) ?? [],
      };
    }),
  });
}

export async function POST(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  await ensureLoose(auth.svc);
  const body = await request.json().catch(() => ({}));
  const r = cleanPrize(body, false);
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const { data, error } = await auth.svc
    .from('logistics_prizes')
    .insert({ ...r.value, created_by: auth.user.id })
    .select(PRIZE_COLUMNS)
    .single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t add the prize.' }, { status: 500 });
  await logPrize(auth.svc, [
    {
      prize_id: data.id as string,
      kind: 'add',
      qty: data.quantity as number,
      sponsor_id: (data.sponsor_id as string | null) ?? null,
      note:
        String(body.note ?? '')
          .trim()
          .slice(0, 300) ||
        (data.source as string | null) ||
        'New prize',
      actor: auth.user.id,
    },
  ]);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'logistics prize', entityId: data.id as string, summary: `Added the prize “${data.name}”` });
  await announce(stockTopic(), { k: 'prizes' }, await whoIs(auth.svc, auth.user.id));
  return NextResponse.json(
    {
      prize: {
        ...data,
        price: data.price === null ? null : Number(data.price),
        allocated: 0,
        left: prizeLeft(data as { quantity: number; size: string | null; stock_level: string }, { allocated: 0 }),
        used_at: [],
      },
    },
    { status: 201 },
  );
}
