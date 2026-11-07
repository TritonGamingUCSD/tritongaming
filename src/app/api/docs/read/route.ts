import { NextResponse } from 'next/server';
import { authorizeDoc } from '@/lib/docs/docsServer';

export const dynamic = 'force-dynamic';

// Opening a doc counts as reading it, but only a doc that is required reading for one of my roles is recorded: { id }.
export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  const auth = await authorizeDoc(id, 'read');
  if ('error' in auth) return auth.error;
  const mine = [...new Set(auth.actor.ctx.roles.map((r) => r.role as string))];
  const { data: req } = await auth.svc
    .from('doc_required_roles')
    .select('role')
    .eq('doc_id', id)
    .in('role', mine.length ? mine : ['none'])
    .limit(1);
  if (!req?.length) return NextResponse.json({ ok: true, required: false });
  await auth.svc.from('doc_reads').upsert({ doc_id: id, user_id: auth.user.id, read_at: new Date().toISOString() }, { onConflict: 'doc_id,user_id' });
  return NextResponse.json({ ok: true, required: true });
}
