import { NextResponse } from 'next/server';
import { UUID, authorizeDocs, bad } from '@/lib/docs/docsServer';

export const dynamic = 'force-dynamic';

// Sets the order of the pinned docs: { ids: [...] }, first to last. Only docs that are pinned take a place in the list.
export async function POST(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String).filter((id: string) => UUID.test(id)).slice(0, 200) : [];
  if (ids.length === 0) return bad('Nothing to order.');
  const results = await Promise.all(ids.map((id, i) => auth.svc.from('docs').update({ pin_order: i }).eq('id', id).eq('pinned', true)));
  if (results.some((r) => r.error)) return bad('Couldn’t save the order.', 500);
  return NextResponse.json({ ok: true });
}
