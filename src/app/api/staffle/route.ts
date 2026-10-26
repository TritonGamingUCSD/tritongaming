import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { logAudit } from '@/lib/notifications/audit';
import { cleanRules } from '@/lib/staffle/rules';
import { freshSlug, notEnough, stateOf, STAFFLE_COLUMNS, UUID } from '@/lib/staffle/server';

export const dynamic = 'force-dynamic';

// Staffles: a raffle among staff for items from Prizing. Every officer and above can look and enter (the Event Logistics view permission); making and drawing them takes the Event Logistics permission.

// The list: each Staffle with what state it is in, how many items, how many you entered and what you won.
export async function GET() {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const { data } = await auth.svc.from('staffles').select(STAFFLE_COLUMNS).order('closes_at', { ascending: false }).limit(300);
  const ids = (data ?? []).map((s) => s.id as string);
  const [{ data: items }, { data: mine }, { data: won }] = ids.length ? await Promise.all([
    auth.svc.from('staffle_items').select('staffle_id, prize_id').in('staffle_id', ids).limit(5000),
    auth.svc.from('staffle_entries').select('staffle_id').eq('user_id', auth.user.id).in('staffle_id', ids).limit(5000),
    auth.svc.from('staffle_winners').select('staffle_id, user_id, passed_at').in('staffle_id', ids).limit(20000),
  ]) : [{ data: [] as { staffle_id: string; prize_id: string }[] }, { data: [] as { staffle_id: string }[] }, { data: [] as { staffle_id: string; user_id: string; passed_at: string | null }[] }];
  const prizeIds = [...new Set((items ?? []).map((i) => i.prize_id as string))];
  const { data: prizes } = prizeIds.length ? await auth.svc.from('logistics_prizes').select('id, photo').in('id', prizeIds) : { data: [] as { id: string; photo: string }[] };
  const photo = new Map((prizes ?? []).map((p) => [p.id as string, p.photo as string]));
  return NextResponse.json({
    canManage: auth.canManage,
    staffles: (data ?? []).map((s) => ({
      id: s.id, slug: s.slug, name: s.name, opens_at: s.opens_at, closes_at: s.closes_at, state: stateOf(s as { status: string; opens_at: string; closes_at: string }),
      items: (items ?? []).filter((i) => i.staffle_id === s.id).length,
      photos: (items ?? []).filter((i) => i.staffle_id === s.id).map((i) => photo.get(i.prize_id as string) ?? '').filter(Boolean).slice(0, 4),
      entered: (mine ?? []).filter((e) => e.staffle_id === s.id).length,
      won: (won ?? []).filter((w) => w.staffle_id === s.id && w.user_id === auth.user.id && !w.passed_at).length,
    })),
  });
}

// Make a Staffle: a name, when it opens and closes, who may enter, a pickup note, and the items (each a prize and how many people win it). The prizes are held back from stock while it runs.
export async function POST(request: Request) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const b = await request.json().catch(() => ({})) as Record<string, unknown>;
  const name = String(b.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!name) return NextResponse.json({ error: 'Give the Staffle a name.' }, { status: 400 });
  const opens = new Date(String(b.opens_at ?? '')), closes = new Date(String(b.closes_at ?? ''));
  if (Number.isNaN(opens.getTime()) || Number.isNaN(closes.getTime())) return NextResponse.json({ error: 'Pick when it opens and when it closes.' }, { status: 400 });
  if (closes <= opens) return NextResponse.json({ error: 'It has to close after it opens.' }, { status: 400 });
  const rawItems = (Array.isArray(b.items) ? b.items : []) as { prize_id?: unknown; winners?: unknown }[];
  const items = rawItems.flatMap((i) => (typeof i.prize_id === 'string' && UUID.test(i.prize_id) ? [{ prize_id: i.prize_id, winners: Math.min(500, Math.max(1, Math.round(Number(i.winners)) || 1)) }] : []));
  if (!items.length) return NextResponse.json({ error: 'Add at least one prize to raffle.' }, { status: 400 });
  if (new Set(items.map((i) => i.prize_id)).size !== items.length) return NextResponse.json({ error: 'A prize can be in a Staffle only once. Give it more winners instead.' }, { status: 400 });
  const short = await notEnough(auth.svc, items);
  if (short) return NextResponse.json({ error: short }, { status: 409 });
  const slug = await freshSlug(auth.svc, name);
  const { data, error } = await auth.svc.from('staffles').insert({
    slug, name, notes: String(b.notes ?? '').trim().slice(0, 2000) || null, pickup_note: String(b.pickup_note ?? '').trim().slice(0, 300) || undefined,
    opens_at: opens.toISOString(), closes_at: closes.toISOString(), rules: cleanRules(b.rules), created_by: auth.user.id,
  }).select(STAFFLE_COLUMNS).single();
  if (error || !data) return NextResponse.json({ error: 'Couldn’t make the Staffle.' }, { status: 500 });
  await auth.svc.from('staffle_items').insert(items.map((i, n) => ({ staffle_id: data.id, prize_id: i.prize_id, winners: i.winners, sort: n })));
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'create', entityType: 'staffle', entityId: data.id as string, summary: `Made the Staffle “${name}” with ${items.length} ${items.length === 1 ? 'prize' : 'prizes'}` });
  return NextResponse.json({ staffle: { id: data.id, slug } }, { status: 201 });
}
