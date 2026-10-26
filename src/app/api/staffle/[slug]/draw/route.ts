import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { logAudit } from '@/lib/notifications/audit';
import { draw } from '@/lib/staffle/draw';
import { loadStaffle, staffleView } from '@/lib/staffle/detail';
import { tellWinners } from '@/lib/staffle/server';

export const dynamic = 'force-dynamic';

// Draw a Staffle: the winners are worked out here, in one go, and saved, so the projector only has to show them (and a reload shows the same). Items come up in random order; nobody wins twice; an item with
// N winners gives N different people. Winners are told. A Staffle can be drawn once (items nobody entered simply have no winner; an unclaimed prize can be drawn again from the rest, see /redraw).
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const row = await loadStaffle(auth.svc, (await params).slug);
  if (!row) return NextResponse.json({ error: 'That Staffle is gone.' }, { status: 404 });
  if (row.status !== 'open') return NextResponse.json({ error: row.status === 'drawn' ? 'It has already been drawn.' : 'That Staffle is over.' }, { status: 409 });
  const id = row.id as string, seed = randomBytes(12).toString('hex');
  // Claim the draw first, so two people pressing Draw together cannot draw twice.
  const { data: locked } = await auth.svc.from('staffles').update({ status: 'drawn', seed, drawn_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'open').select('id');
  if (!locked?.length) return NextResponse.json({ error: 'It has already been drawn.' }, { status: 409 });
  const [{ data: items }, { data: entries }] = await Promise.all([
    auth.svc.from('staffle_items').select('id, winners, prize_id').eq('staffle_id', id).order('sort'),
    auth.svc.from('staffle_entries').select('item_id, user_id').eq('staffle_id', id).limit(30000),
  ]);
  const { won } = draw((items ?? []).map((i) => ({ id: i.id as string, winners: i.winners as number, entrants: (entries ?? []).filter((e) => e.item_id === i.id).map((e) => e.user_id as string) })), seed);
  if (won.length) await auth.svc.from('staffle_winners').insert(won.map((w) => ({ staffle_id: id, item_id: w.item_id, user_id: w.user_id, position: w.position })));
  await tellWinners(auth.svc, row, won.map((w) => ({ user_id: w.user_id, item_id: w.item_id })), (items ?? []) as { id: string; prize_id: string }[]);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'staffle', entityId: id, summary: `Drew the Staffle “${row.name}”: ${won.length} ${won.length === 1 ? 'winner' : 'winners'}` });
  const fresh = await loadStaffle(auth.svc, id);
  return NextResponse.json({ staffle: await staffleView(auth.svc, fresh!, auth.user.id, true) });
}
