import { NextResponse } from 'next/server';
import { hasCapability } from '@/lib/capabilities';
import { authorizeDocs, editingNow, namesOf } from '@/lib/docsServer';

export const dynamic = 'force-dynamic';

// A light snapshot of every doc (no text) so an open page can notice what other people changed: renamed, moved, deleted, published, a draft saved, someone
// editing. Polled while the docs are open. Readers only see live docs; editors also see unpublished ones and drafts.
export async function GET() {
  const auth = await authorizeDocs('view_docs');
  if ('error' in auth) return auth.error;
  const canEdit = hasCapability(auth.roles, 'manage_docs');
  let q = auth.svc.from('docs').select('id, title, slug, parent_id, category_id, order_index, revision, updated_at, updated_by, published, icon, cover_url, tags, pinned, draft_updated_at, draft_updated_by');
  if (!canEdit) q = q.eq('published', true);
  const [{ data: docs }, { data: categories }] = await Promise.all([q, auth.svc.from('doc_categories').select('id, name, order_index, created_at')]);
  const rows = docs ?? [];
  const names = await namesOf(auth.svc, rows.flatMap((d) => [d.updated_by as string | null, canEdit ? (d.draft_updated_by as string | null) : null]));
  const editing = canEdit ? await editingNow(auth.svc, rows.map((d) => d.id as string), auth.user.id) : new Map<string, string[]>();
  return NextResponse.json({
    docs: rows.map((d) => ({
      id: d.id, title: d.title, slug: d.slug, parent_id: d.parent_id, category_id: d.category_id, order_index: d.order_index, revision: d.revision, updated_at: d.updated_at,
      updated_by_name: d.updated_by ? names.get(d.updated_by as string) ?? null : null, published: d.published, icon: d.icon, cover_url: d.cover_url, tags: d.tags, pinned: d.pinned,
      draft_updated_at: canEdit ? d.draft_updated_at : null, draft_by_name: canEdit && d.draft_updated_by ? names.get(d.draft_updated_by as string) ?? null : null,
      draft_by_me: canEdit && d.draft_updated_by === auth.user.id, editing: editing.get(d.id as string) ?? [],
    })),
    categories: categories ?? [],
  });
}
