import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { logAudit } from '@/lib/notifications/audit';
import { draw, ranksFor } from '@/lib/staffle/draw';
import { eligibleIds } from '@/lib/staffle/eligible';
import { cleanRules } from '@/lib/staffle/rules';
import { loadStaffle, staffleView } from '@/lib/staffle/detail';
import { tellWinners } from '@/lib/staffle/server';

export const dynamic = 'force-dynamic';

// Draw a Staffle: the winners are worked out here, in one go, and saved, so the projector only has to show them (and a reload shows the same). The prizes are drawn most valuable first (or in the host's own order) and people who do not win stay in for the later ones; among prizes of the same rank the least contested goes first; nobody wins twice; an item with
// N winners gives N different people; a prize with fewer entrants than winners goes to all of them, and any spot still open is filled from the people who said they would take anything, then from everyone else who may enter. Winners are told. A Staffle can be drawn once (an unclaimed prize can be drawn again from the rest, see /redraw).
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const row = await loadStaffle(auth.svc, (await params).slug);
  if (!row) return NextResponse.json({ error: 'That Staffle is gone.' }, { status: 404 });
  if (row.status === 'draft') return NextResponse.json({ error: 'Open it first, so people can enter.' }, { status: 409 });
  if (row.status !== 'open' && row.status !== 'closed')
    return NextResponse.json({ error: row.status === 'drawn' ? 'It has already been drawn.' : 'That Staffle is over.' }, { status: 409 });
  const id = row.id as string,
    seed = randomBytes(12).toString('hex');
  const { count: itemCount } = await auth.svc.from('staffle_items').select('id', { count: 'exact', head: true }).eq('staffle_id', id);
  if (!itemCount) return NextResponse.json({ error: 'Pick its prizes first.' }, { status: 409 });
  // Claim the draw first, so two people pressing Draw together cannot draw twice.
  const { data: locked } = await auth.svc
    .from('staffles')
    .update({ status: 'drawn', seed, drawn_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['open', 'closed'])
    .select('id');
  if (!locked?.length) return NextResponse.json({ error: 'It has already been drawn.' }, { status: 409 });
  const [{ data: items }, { data: entries }, { data: anything }, everyone] = await Promise.all([
    auth.svc.from('staffle_items').select('id, winners, prize_id, draw_order').eq('staffle_id', id).order('sort'),
    auth.svc.from('staffle_entries').select('item_id, user_id').eq('staffle_id', id).limit(30000),
    auth.svc.from('staffle_anything').select('user_id').eq('staffle_id', id).limit(5000),
    eligibleIds(auth.svc, cleanRules(row.rules)),
  ]);
  const { data: prices } = await auth.svc
    .from('logistics_prizes')
    .select('id, price')
    .in(
      'id',
      (items ?? []).map((i) => i.prize_id as string),
    );
  const price = new Map((prices ?? []).map((p) => [p.id as string, Number(p.price) || 0]));
  const ranks = ranksFor((items ?? []).map((i) => ({ id: i.id as string, draw_order: (i.draw_order as number | null) ?? null, price: price.get(i.prize_id as string) ?? 0 })));
  const { won } = draw(
    (items ?? []).map((i) => ({
      id: i.id as string,
      winners: i.winners as number,
      rank: ranks.get(i.id as string),
      entrants: (entries ?? []).filter((e) => e.item_id === i.id).map((e) => e.user_id as string),
    })),
    seed,
    [],
    { anything: (anything ?? []).map((a) => a.user_id as string), everyone },
  );
  if (won.length) await auth.svc.from('staffle_winners').insert(won.map((w) => ({ staffle_id: id, item_id: w.item_id, user_id: w.user_id, position: w.position, via: w.via })));
  await tellWinners(
    auth.svc,
    row,
    won.map((w) => ({ user_id: w.user_id, item_id: w.item_id })),
    (items ?? []) as { id: string; prize_id: string }[],
  );
  await logAudit(auth.svc, {
    actorId: auth.user.id,
    action: 'update',
    entityType: 'staffle',
    entityId: id,
    summary: `Drew the Staffle “${row.name}”: ${won.length} ${won.length === 1 ? 'winner' : 'winners'}`,
  });
  const fresh = await loadStaffle(auth.svc, id);
  return NextResponse.json({ staffle: await staffleView(auth.svc, fresh!, auth.user.id, true) });
}
