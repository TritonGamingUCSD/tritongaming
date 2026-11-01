import { NextResponse } from 'next/server';
import { authorizeLogistics } from '@/lib/logistics/auth';
import { loadStaffle, staffleView } from '@/lib/staffle/detail';
import { canEnter, cleanRules } from '@/lib/staffle/rules';
import { personFacts } from '@/lib/staffle/server';

export const dynamic = 'force-dynamic';

// "I'll take anything left" (POST { on: boolean }): if a prize is nobody's pick, or has spots left after the draw, people who said this are chosen first. Allowed while the Staffle is open and the rules let you in.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorizeLogistics('view');
  if (auth.error) return auth.error;
  const row = await loadStaffle(auth.svc, (await params).slug);
  if (!row) return NextResponse.json({ error: 'That Staffle is gone.' }, { status: 404 });
  if (row.status !== 'open') return NextResponse.json({ error: row.status === 'draft' ? 'It has not opened yet.' : 'Entries are closed.' }, { status: 409 });
  const b = (await request.json().catch(() => ({}))) as { on?: unknown };
  if (b.on !== false) {
    const verdict = canEnter(cleanRules(row.rules), await personFacts(auth.svc, auth.user.id));
    if (!verdict.ok) return NextResponse.json({ error: verdict.why }, { status: 403 });
    const { error } = await auth.svc.from('staffle_anything').upsert({ staffle_id: row.id, user_id: auth.user.id }, { onConflict: 'staffle_id,user_id', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: 'Couldn’t save that.' }, { status: 500 });
  } else {
    await auth.svc.from('staffle_anything').delete().eq('staffle_id', row.id).eq('user_id', auth.user.id);
  }
  return NextResponse.json({ staffle: await staffleView(auth.svc, row, auth.user.id, auth.canManage) });
}
