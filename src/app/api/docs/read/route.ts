import { NextResponse } from 'next/server';
import { UUID, authorizeDocs, bad } from '@/lib/docsServer';

export const dynamic = 'force-dynamic';

// Opening a doc counts as reading it, but only a doc that is required reading for one of my roles is recorded: { id }.
export async function POST(request: Request) {
  const auth = await authorizeDocs('view_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Doc not found.', 404);
  const mine = [...new Set((auth.roles as { role: string }[]).map((r) => r.role))];
  const { data: req } = await auth.svc.from('doc_required_roles').select('role').eq('doc_id', id).in('role', mine.length ? mine : ['none']).limit(1);
  if (!req?.length) return NextResponse.json({ ok: true, required: false });
  await auth.svc.from('doc_reads').upsert({ doc_id: id, user_id: auth.user.id, read_at: new Date().toISOString() }, { onConflict: 'doc_id,user_id' });
  return NextResponse.json({ ok: true, required: true });
}
