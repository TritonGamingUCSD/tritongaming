import { NextResponse } from 'next/server';
import { UUID, authorizeDocs, bad } from '@/lib/docs/docsServer';

export const dynamic = 'force-dynamic';

// Star or un-star a doc for myself: { id, on: boolean }.
export async function POST(request: Request) {
  const auth = await authorizeDocs('view_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Doc not found.', 404);
  if (b.on) await auth.svc.from('doc_favorites').upsert({ user_id: auth.user.id, doc_id: id }, { onConflict: 'user_id,doc_id' });
  else await auth.svc.from('doc_favorites').delete().eq('user_id', auth.user.id).eq('doc_id', id);
  return NextResponse.json({ ok: true });
}
