import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { logAudit } from '@/lib/notifications/audit';
import { loadStaffle, staffleView } from '@/lib/staffle/detail';
import { cleanRules, rulesEmpty } from '@/lib/staffle/rules';
import { BEFORE_DRAW, notEnough, UUID } from '@/lib/staffle/server';

export const dynamic = 'force-dynamic';

// One Staffle (every officer and above can look): its items, who entered, you, and once drawn the winners.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const row = await loadStaffle(auth.svc, (await params).slug);
  if (!row) return NextResponse.json({ error: 'That Staffle is gone.' }, { status: 404 });
  return NextResponse.json({ staffle: await staffleView(auth.svc, row, auth.user.id, auth.canManage) });
}

// Change a Staffle: its name, note, who may enter and (until it is drawn) its items; open it or close it (by hand), or end it (what was not claimed is free again).
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const row = await loadStaffle(auth.svc, (await params).slug);
  if (!row) return NextResponse.json({ error: 'That Staffle is gone.' }, { status: 404 });
  const id = row.id as string;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.name === 'string') {
    const n = b.name.trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!n) return NextResponse.json({ error: 'Give the Staffle a name.' }, { status: 400 });
    patch.name = n;
  }
  if ('notes' in b)
    patch.notes =
      String(b.notes ?? '')
        .trim()
        .slice(0, 2000) || null;
  if (typeof b.pickup_note === 'string') patch.pickup_note = b.pickup_note.trim().slice(0, 300) || 'Pick it up from Event Logistics and tell them your name.';
  if ('rules' in b) {
    const rules = cleanRules(b.rules);
    if (rulesEmpty(rules)) return NextResponse.json({ error: 'Pick at least one role or person who can enter.' }, { status: 400 });
    patch.rules = rules;
  }
  if (b.status === 'open' || b.status === 'closed') {
    if (b.status === 'open') {
      const { count } = await auth.svc.from('staffle_items').select('id', { count: 'exact', head: true }).eq('staffle_id', id);
      if (!count) return NextResponse.json({ error: 'Pick its prizes first, then open it.' }, { status: 409 });
    }
    if (b.status === 'open' && row.status !== 'draft' && row.status !== 'closed')
      return NextResponse.json({ error: row.status === 'open' ? 'It is already open.' : 'It has been drawn, so it can’t open again.' }, { status: 409 });
    if (b.status === 'closed' && row.status !== 'open')
      return NextResponse.json({ error: row.status === 'closed' ? 'It is already closed.' : 'Only an open Staffle can be closed.' }, { status: 409 });
    patch.status = b.status;
  }
  if (b.status === 'ended') {
    if (row.status === 'ended') return NextResponse.json({ error: 'That Staffle is already over.' }, { status: 409 });
    if (row.status !== 'drawn') return NextResponse.json({ error: 'Only a drawn Staffle can be ended. Remove one that was not drawn.' }, { status: 409 });
    patch.status = b.status;
  }
  if (Array.isArray(b.items)) {
    if (!BEFORE_DRAW.includes(row.status as string)) return NextResponse.json({ error: 'The items can’t change once it is drawn.' }, { status: 409 });
    const items = (b.items as { prize_id?: unknown; winners?: unknown }[]).flatMap((i) =>
      typeof i.prize_id === 'string' && UUID.test(i.prize_id) ? [{ prize_id: i.prize_id, winners: Math.min(500, Math.max(1, Math.round(Number(i.winners)) || 1)) }] : [],
    );
    if (new Set(items.map((i) => i.prize_id)).size !== items.length)
      return NextResponse.json({ error: 'A prize can be in a Staffle only once. Give it more winners instead.' }, { status: 400 });
    const short = items.length ? await notEnough(auth.svc, items, id) : null;
    if (short) return NextResponse.json({ error: short }, { status: 409 });
    const { data: have } = await auth.svc.from('staffle_items').select('id, prize_id').eq('staffle_id', id);
    const keep = new Map((have ?? []).map((h) => [h.prize_id as string, h.id as string]));
    const drop = (have ?? []).filter((h) => !items.some((i) => i.prize_id === h.prize_id)).map((h) => h.id as string);
    if (drop.length) await auth.svc.from('staffle_items').delete().in('id', drop); // their entries go with them
    for (const [n, i] of items.entries()) {
      const kept = keep.get(i.prize_id);
      if (kept) await auth.svc.from('staffle_items').update({ winners: i.winners, sort: n }).eq('id', kept);
      else await auth.svc.from('staffle_items').insert({ staffle_id: id, prize_id: i.prize_id, winners: i.winners, sort: n });
    }
  }
  const { error } = await auth.svc.from('staffles').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  await logAudit(auth.svc, {
    actorId: auth.user.id,
    action: 'update',
    entityType: 'staffle',
    entityId: id,
    summary: `${{ ended: 'Ended', open: 'Opened', closed: 'Closed' }[patch.status as string] ?? 'Changed'} the Staffle “${(patch.name as string | undefined) ?? row.name}”`,
  });
  const fresh = await loadStaffle(auth.svc, id);
  return NextResponse.json({ staffle: await staffleView(auth.svc, fresh!, auth.user.id, true) });
}

// Remove a Staffle (its items, entries and winners go with it). One with prizes already claimed is ended instead, so the claims stay on record.
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const row = await loadStaffle(auth.svc, (await params).slug);
  if (!row) return NextResponse.json({ error: 'That Staffle is gone.' }, { status: 404 });
  const { count } = await auth.svc
    .from('staffle_winners')
    .select('id', { count: 'exact', head: true })
    .eq('staffle_id', row.id as string)
    .not('claimed_at', 'is', null);
  if (count) return NextResponse.json({ error: 'Some of its prizes were claimed. End it instead, so that stays on record.' }, { status: 409 });
  await auth.svc
    .from('staffles')
    .delete()
    .eq('id', row.id as string);
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'delete', entityType: 'staffle', entityId: row.id as string, summary: `Removed the Staffle “${row.name}”` });
  return NextResponse.json({ ok: true });
}
