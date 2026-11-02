import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { logAudit } from '@/lib/notifications/audit';
import { loadStaffle } from '@/lib/staffle/detail';
import { applyItems } from '@/lib/staffle/items';
import { BEFORE_DRAW, UUID } from '@/lib/staffle/server';

export const dynamic = 'force-dynamic';

// One prize in one Staffle, for the Prizing sheet: PUT { prize_id, winners } puts the prize in the Staffle with that many winners (changing it when it is already there), and winners 0 takes it out. Only before the Staffle is drawn, and only
// as much as is left in stock to hold back (checked like picking prizes on the Staffle's own page).
export async function PUT(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeLogistics('manage');
  if (auth.error) return auth.error;
  const row = await loadStaffle(auth.svc, (await params).slug);
  if (!row) return NextResponse.json({ error: 'That Staffle is gone.' }, { status: 404 });
  if (!BEFORE_DRAW.includes(row.status as string)) return NextResponse.json({ error: 'The prizes can’t change once it is drawn.' }, { status: 409 });
  const b = (await request.json().catch(() => ({}))) as { prize_id?: unknown; winners?: unknown };
  if (typeof b.prize_id !== 'string' || !UUID.test(b.prize_id)) return NextResponse.json({ error: 'Pick a prize.' }, { status: 400 });
  const winners = Math.min(500, Math.max(0, Math.round(Number(b.winners)) || 0));
  const id = row.id as string;
  const { data: have } = await auth.svc.from('staffle_items').select('prize_id, winners, draw_order').eq('staffle_id', id).order('sort');
  const items = (have ?? []).map((h) => ({ prize_id: h.prize_id as string, winners: h.winners as number, draw_order: (h.draw_order as number | null) ?? null }));
  const at = items.findIndex((i) => i.prize_id === b.prize_id);
  if (winners === 0) {
    if (at >= 0) items.splice(at, 1);
  } else if (at >= 0) items[at] = { ...items[at], winners };
  else items.push({ prize_id: b.prize_id, winners, draw_order: null });
  const failed = await applyItems(auth.svc, id, items);
  if (failed) return NextResponse.json({ error: failed.error }, { status: failed.status });
  await auth.svc.from('staffles').update({ updated_at: new Date().toISOString() }).eq('id', id);
  await logAudit(auth.svc, {
    actorId: auth.user.id,
    action: 'update',
    entityType: 'staffle',
    entityId: id,
    summary: `Changed the prizes of the Staffle “${row.name}” from the Prizing sheet`,
  });
  return NextResponse.json({ ok: true });
}
