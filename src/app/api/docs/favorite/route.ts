import { NextResponse } from 'next/server';
import { authorizeDoc } from '@/lib/docs/docsServer';

export const dynamic = 'force-dynamic';

// Star or un-star a doc for myself: { id, on: boolean }.
export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  const auth = await authorizeDoc(id, 'read');
  if ('error' in auth) return auth.error;
  if (b.on) await auth.svc.from('doc_favorites').upsert({ user_id: auth.user.id, doc_id: id }, { onConflict: 'user_id,doc_id' });
  else await auth.svc.from('doc_favorites').delete().eq('user_id', auth.user.id).eq('doc_id', id);
  return NextResponse.json({ ok: true });
}
