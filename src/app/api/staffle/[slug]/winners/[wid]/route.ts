import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { bumpStock, logPrize } from '@/lib/logistics/prizeServer';
import { whoIs } from '@/lib/logistics/live';
import { logAudit } from '@/lib/notifications/audit';
import { loadStaffle, staffleView } from '@/lib/staffle/detail';
import { UUID } from '@/lib/staffle/server';

export const dynamic = 'force-dynamic';

// Mark a winner's prize claimed (or not claimed again). Claiming takes one of the prize out of stock (and puts it back if undone); a free prize counted loosely has no count to change. Staff do this at pickup.
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; wid: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const { slug, wid } = await params;
  const row = await loadStaffle(auth.svc, slug);
  if (!row || !UUID.test(wid)) return NextResponse.json({ error: 'That Staffle is gone.' }, { status: 404 });
  if (row.status === 'cancelled') return NextResponse.json({ error: 'That Staffle was cancelled.' }, { status: 409 });
  const b = await request.json().catch(() => ({})) as { claimed?: unknown };
  const { data: w } = await auth.svc.from('staffle_winners').select('id, item_id, user_id, claimed_at, passed_at').eq('id', wid).eq('staffle_id', row.id as string).maybeSingle();
  if (!w) return NextResponse.json({ error: 'That winner is gone.' }, { status: 404 });
  if (w.passed_at) return NextResponse.json({ error: 'That winner was passed over.' }, { status: 409 });
  const claim = b.claimed !== false;
  if (claim === !!w.claimed_at) return NextResponse.json({ staffle: await staffleView(auth.svc, row, auth.user.id, true) });
  const { data: item } = await auth.svc.from('staffle_items').select('prize_id').eq('id', w.item_id as string).maybeSingle();
  const { error } = await auth.svc.from('staffle_winners').update({ claimed_at: claim ? new Date().toISOString() : null, claimed_by: claim ? auth.user.id : null }).eq('id', wid);
  if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  if (item) {
    const who = await whoIs(auth.svc, auth.user.id);
    await bumpStock(auth.svc, item.prize_id as string, claim ? -1 : 1, who);
    if (claim) await logPrize(auth.svc, [{ prize_id: item.prize_id as string, kind: 'give', qty: -1, plan_name: String(row.name), note: 'Claimed from a Staffle', ref: `staffle:${wid}`, actor: auth.user.id }]);
    else await auth.svc.from('logistics_prize_log').delete().eq('ref', `staffle:${wid}`);
  }
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'staffle', entityId: row.id as string, summary: `${claim ? 'Marked claimed' : 'Marked not claimed'} a prize in the Staffle “${row.name}”` });
  return NextResponse.json({ staffle: await staffleView(auth.svc, row, auth.user.id, true) });
}
