import { DOC_LIST_COLUMNS, docCan, loadDocActor } from '@/lib/docs/docsServer';
import type { ClubDocLists } from '@/lib/docs/access';
import { NextResponse } from 'next/server';
import { UUID, authorizeDocs, bad } from '@/lib/docs/docsServer';
import { notifyDocs } from '@/lib/docs/docsLive';

export const dynamic = 'force-dynamic';

// Sets the order of the pinned docs: { ids: [...] }, first to last. Only docs that are pinned take a place in the list.
export async function POST(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  let ids: string[] = Array.isArray(b.ids)
    ? b.ids
        .map(String)
        .filter((id: string) => UUID.test(id))
        .slice(0, 200)
    : [];
  if (ids.length === 0) return bad('Nothing to order.');
  // only docs this person may edit take a place they chose
  const { data: lists } = await auth.svc.from('docs').select(DOC_LIST_COLUMNS).in('id', ids);
  const actor = await loadDocActor(auth.svc, auth.user.id);
  const editable = new Set((lists ?? []).filter((d) => docCan(actor, d as unknown as ClubDocLists).edit).map((d) => d.id as string));
  ids = ids.filter((id) => editable.has(id));
  const results = await Promise.all(ids.map((id, i) => auth.svc.from('docs').update({ pin_order: i }).eq('id', id).eq('pinned', true)));
  if (results.some((r) => r.error)) return bad('Couldn’t save the order.', 500);
  await notifyDocs();
  return NextResponse.json({ ok: true });
}
