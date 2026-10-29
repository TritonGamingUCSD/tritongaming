import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { loadStaffle, staffleView } from '@/lib/staffle/detail';
import { canEnter, cleanRules } from '@/lib/staffle/rules';
import { personFacts, UUID } from '@/lib/staffle/server';

export const dynamic = 'force-dynamic';

// Enter or leave one item of a Staffle (one free entry per item). Allowed while it is open and the rules let you in (checked now, as you enter); entries stop when it is closed.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const row = await loadStaffle(auth.svc, (await params).slug);
  if (!row) return NextResponse.json({ error: 'That Staffle is gone.' }, { status: 404 });
  if (row.status !== 'open') return NextResponse.json({ error: row.status === 'draft' ? 'It has not opened yet.' : 'Entries are closed.' }, { status: 409 });
  const b = (await request.json().catch(() => ({}))) as { item_id?: unknown; enter?: unknown };
  if (typeof b.item_id !== 'string' || !UUID.test(b.item_id)) return NextResponse.json({ error: 'Pick an item.' }, { status: 400 });
  const { data: item } = await auth.svc
    .from('staffle_items')
    .select('id')
    .eq('id', b.item_id)
    .eq('staffle_id', row.id as string)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: 'That item is gone.' }, { status: 404 });
  if (b.enter !== false) {
    const verdict = canEnter(cleanRules(row.rules), await personFacts(auth.svc, auth.user.id));
    if (!verdict.ok) return NextResponse.json({ error: verdict.why }, { status: 403 });
    const { error } = await auth.svc
      .from('staffle_entries')
      .upsert({ staffle_id: row.id, item_id: b.item_id, user_id: auth.user.id }, { onConflict: 'item_id,user_id', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: 'Couldn’t enter.' }, { status: 500 });
  } else {
    await auth.svc.from('staffle_entries').delete().eq('item_id', b.item_id).eq('user_id', auth.user.id);
  }
  return NextResponse.json({ staffle: await staffleView(auth.svc, row, auth.user.id, auth.canManage) });
}
