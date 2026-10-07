import { NextResponse } from 'next/server';
import { descendantIds } from '@/lib/docs/docsTree';
import { UUID, authorizeDocs, bad, editingNow } from '@/lib/docs/docsServer';
import { notifyDocs } from '@/lib/docs/docsLive';

export const dynamic = 'force-dynamic';

// Delete a doc and every page inside it: { id, force? }. Asks first (409 'being_edited') when someone has it, or a page inside it, open in the editor,
// or holds an unpublished draft there (409 'has_drafts'), since deleting throws that work away.
export async function POST(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Doc not found.', 404);
  const { data } = await auth.svc.from('docs').select('id, title, parent_id, category_id, order_index, draft_updated_at, draft_updated_by');
  const docs = (data ?? []) as { id: string; title: string; parent_id: string | null; category_id: string | null; order_index: number; draft_updated_at: string | null; draft_updated_by: string | null }[];
  if (!docs.some((d) => d.id === id)) return NextResponse.json({ ok: true, already: true });
  const inside = [id, ...descendantIds(docs, id)];
  if (!b.force) {
    const editing = await editingNow(auth.svc, inside, auth.user.id);
    if (editing.size) {
      const names = [...new Set([...editing.values()].flat())];
      const where = [...editing.keys()].map((k) => docs.find((d) => d.id === k)?.title).filter(Boolean);
      return NextResponse.json({ error: `${names.join(', ')} ${names.length === 1 ? 'has' : 'have'} ${where.length > 1 || where[0] !== docs.find((d) => d.id === id)?.title ? `“${where.join('”, “')}”` : 'this doc'} open right now.`, code: 'being_edited', names }, { status: 409 });
    }
    const drafts = docs.filter((d) => inside.includes(d.id) && d.draft_updated_at && d.draft_updated_by && d.draft_updated_by !== auth.user.id);
    if (drafts.length) return NextResponse.json({ error: `${drafts.length === 1 ? 'A page has' : `${drafts.length} pages have`} unpublished changes by someone else.`, code: 'has_drafts', titles: drafts.map((d) => d.title) }, { status: 409 });
  }
  const { error } = await auth.svc.from('docs').delete().eq('id', id);
  if (error) return bad('Couldn’t delete that.', 500);
  await notifyDocs();
  return NextResponse.json({ ok: true, removed: inside.length });
}
