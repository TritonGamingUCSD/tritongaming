import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { logAudit } from '@/lib/notifications/audit';
import { draw } from '@/lib/staffle/draw';
import { loadStaffle, staffleView } from '@/lib/staffle/detail';
import { tellWinners, UUID } from '@/lib/staffle/server';

export const dynamic = 'force-dynamic';

// Draw again for a prize nobody picked up: `winner_id` passes over one winner and picks a replacement for the same item; `item_id` does it for every winner of that item who has not claimed. The new winners come from the
// people who entered that item and have not won (or been passed over) in this Staffle. A passed-over winner is kept, so they cannot be picked again, and no longer holds the prize back from stock.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const row = await loadStaffle(auth.svc, (await params).slug);
  if (!row) return NextResponse.json({ error: 'That Staffle is gone.' }, { status: 404 });
  if (row.status !== 'drawn') return NextResponse.json({ error: 'Only a drawn Staffle can be drawn again.' }, { status: 409 });
  const id = row.id as string;
  const b = await request.json().catch(() => ({})) as { winner_id?: unknown; item_id?: unknown };
  const { data: all } = await auth.svc.from('staffle_winners').select('id, item_id, user_id, position, claimed_at, passed_at').eq('staffle_id', id);
  let itemId: string | null = null, toPass: { id: string }[] = [];
  if (typeof b.winner_id === 'string' && UUID.test(b.winner_id)) {
    const w = (all ?? []).find((x) => x.id === b.winner_id);
    if (!w || w.claimed_at || w.passed_at) return NextResponse.json({ error: 'That winner can’t be passed over (they claimed it, or were already passed).' }, { status: 409 });
    itemId = w.item_id as string; toPass = [{ id: w.id as string }];
  } else if (typeof b.item_id === 'string' && UUID.test(b.item_id)) {
    itemId = b.item_id;
    toPass = (all ?? []).filter((x) => x.item_id === itemId && !x.claimed_at && !x.passed_at).map((x) => ({ id: x.id as string }));
    if (!toPass.length) return NextResponse.json({ error: 'Everyone who won that has claimed it.' }, { status: 409 });
  } else return NextResponse.json({ error: 'Pick a winner or an item.' }, { status: 400 });
  const { data: item } = await auth.svc.from('staffle_items').select('id, prize_id').eq('id', itemId).eq('staffle_id', id).maybeSingle();
  if (!item) return NextResponse.json({ error: 'That item is gone.' }, { status: 404 });
  const { data: entries } = await auth.svc.from('staffle_entries').select('user_id').eq('item_id', itemId);
  const taken = new Set((all ?? []).map((x) => x.user_id as string));   // everyone who won or was passed over in this Staffle
  const seed = randomBytes(12).toString('hex');
  const { won } = draw([{ id: itemId!, winners: toPass.length, entrants: (entries ?? []).map((e) => e.user_id as string) }], seed, taken);
  await auth.svc.from('staffle_winners').update({ passed_at: new Date().toISOString() }).in('id', toPass.map((w) => w.id));
  const start = Math.max(-1, ...(all ?? []).map((x) => x.position as number)) + 1;
  if (won.length) await auth.svc.from('staffle_winners').insert(won.map((w, n) => ({ staffle_id: id, item_id: itemId, user_id: w.user_id, position: start + n })));
  await tellWinners(auth.svc, row, won.map((w) => ({ user_id: w.user_id, item_id: itemId! })), [{ id: itemId!, prize_id: item.prize_id as string }]);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'staffle', entityId: id, summary: `Drew again in the Staffle “${row.name}”: ${toPass.length} passed over, ${won.length} new ${won.length === 1 ? 'winner' : 'winners'}` });
  const fresh = await loadStaffle(auth.svc, id);
  return NextResponse.json({ staffle: await staffleView(auth.svc, fresh!, auth.user.id, true), replaced: won.length, short: toPass.length - won.length });
}
