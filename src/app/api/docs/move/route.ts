import { NextResponse } from 'next/server';
import { canMoveUnder, reorder } from '@/lib/docs/docsTree';
import { UUID, authorizeDocs, bad } from '@/lib/docs/docsServer';

export const dynamic = 'force-dynamic';

// Move a page: { id, parent_id: string | null, category_id?: string | null, before_id?: string | null, from_parent_id?: string | null, force?: boolean }.
// `from_parent_id` is where the mover's screen thought the page was: if someone already moved it, that is reported (409 'moved_elsewhere') instead of silently moving it again.
// Under a parent it follows the parent's category; at the top it takes `category_id`. `before_id` puts it ahead of that sibling, otherwise last.
export async function POST(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  const parentId = b.parent_id ? String(b.parent_id) : null;
  const beforeId = b.before_id ? String(b.before_id) : null;
  const categoryId = b.category_id ? String(b.category_id) : null;
  if (!UUID.test(id) || (parentId && !UUID.test(parentId)) || (beforeId && !UUID.test(beforeId)) || (categoryId && !UUID.test(categoryId))) return bad('Doc not found.', 404);
  const { data } = await auth.svc.from('docs').select('id, title, parent_id, category_id, order_index');
  const docs = (data ?? []) as { id: string; title: string; parent_id: string | null; category_id: string | null; order_index: number }[];
  const me = docs.find((d) => d.id === id);
  if (!me) return NextResponse.json({ error: 'This page was deleted by someone else.', code: 'deleted' }, { status: 404 });
  if (parentId && !docs.some((d) => d.id === parentId)) return NextResponse.json({ error: 'The page you were moving it into was deleted by someone else.', code: 'parent_deleted' }, { status: 404 });
  if ('from_parent_id' in b && !b.force && (b.from_parent_id ? String(b.from_parent_id) : null) !== (me.parent_id ?? null)) {
    const now = me.parent_id ? docs.find((d) => d.id === me.parent_id)?.title ?? 'another page' : 'the top level';
    return NextResponse.json({ error: `Someone already moved “${me.title}” to ${now}.`, code: 'moved_elsewhere', parent_id: me.parent_id }, { status: 409 });
  }
  if (!canMoveUnder(docs, id, parentId)) return bad('A page can’t go inside itself or one of its own sub-pages.');
  const newCategory = parentId ? null : categoryId;
  const siblings = docs.filter((d) => d.id !== id && (d.parent_id ?? null) === parentId && (parentId ? true : (d.category_id ?? null) === newCategory));
  const order = reorder([...siblings, { ...me, order_index: -1 }], id, beforeId);
  const changed: { id: string; parent_id: string | null; category_id: string | null; order_index: number }[] = [];
  for (const o of order) {
    const row = docs.find((d) => d.id === o.id)!;
    const patch = o.id === id ? { parent_id: parentId, category_id: newCategory, order_index: o.order_index } : { order_index: o.order_index };
    const { error } = await auth.svc.from('docs').update(patch).eq('id', o.id);
    if (error) return bad('Couldn’t move that.', 500);
    changed.push({ id: o.id, parent_id: o.id === id ? parentId : row.parent_id, category_id: o.id === id ? newCategory : row.category_id, order_index: o.order_index });
  }
  if (!changed.some((c) => c.id === id)) {
    await auth.svc.from('docs').update({ parent_id: parentId, category_id: newCategory }).eq('id', id);
    changed.push({ id, parent_id: parentId, category_id: newCategory, order_index: me.order_index });
  }
  return NextResponse.json({ changed });
}
