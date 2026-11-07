import { NextResponse } from 'next/server';
import type { ClubDocLists } from '@/lib/docs/access';
import { authorizeDocs, docCan, editingNow, loadDocActor, namesOf } from '@/lib/docs/docsServer';

export const dynamic = 'force-dynamic';

// A light snapshot of every doc (no text) so an open page can notice what other people changed: renamed, moved, deleted, published, a draft saved, someone
// editing. Polled while the docs are open. Readers only see live docs; editors also see unpublished ones and drafts.
export async function GET() {
  const auth = await authorizeDocs('view_docs');
  if ('error' in auth) return auth.error;
  const actor = await loadDocActor(auth.svc, auth.user.id);
  const [{ data: docs }, { data: categories }] = await Promise.all([
    auth.svc
      .from('docs')
      .select(
        'id, title, slug, parent_id, category_id, order_index, revision, updated_at, updated_by, published, icon, cover_url, tags, pinned, teams, draft_updated_at, draft_updated_by, read_access, edit_access',
      ),
    auth.svc.from('doc_categories').select('id, name, order_index, color, created_at'),
  ]);
  // Only the docs this person may read; the unpublished ones and the drafts only where they may edit.
  const rows = (docs ?? []).map((d) => ({ d, can: docCan(actor, d as unknown as ClubDocLists) })).filter(({ d, can }) => (can.read || can.edit) && (d.published || can.edit));
  const names = await namesOf(
    auth.svc,
    rows.flatMap(({ d, can }) => [d.updated_by as string | null, can.edit ? (d.draft_updated_by as string | null) : null]),
  );
  const editing = await editingNow(
    auth.svc,
    rows.filter(({ can }) => can.edit).map(({ d }) => d.id as string),
    auth.user.id,
  );
  return NextResponse.json({
    docs: rows.map(({ d, can }) => ({
      id: d.id,
      title: d.title,
      slug: d.slug,
      parent_id: d.parent_id,
      category_id: d.category_id,
      order_index: d.order_index,
      revision: d.revision,
      updated_at: d.updated_at,
      updated_by_name: d.updated_by ? (names.get(d.updated_by as string) ?? null) : null,
      published: d.published,
      icon: d.icon,
      cover_url: d.cover_url,
      tags: d.tags,
      pinned: d.pinned,
      teams: d.teams,
      can_edit: can.edit,
      draft_updated_at: can.edit ? d.draft_updated_at : null,
      draft_by_name: can.edit && d.draft_updated_by ? (names.get(d.draft_updated_by as string) ?? null) : null,
      draft_by_me: can.edit && d.draft_updated_by === auth.user.id,
      editing: editing.get(d.id as string) ?? [],
    })),
    categories: categories ?? [],
  });
}
