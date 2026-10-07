import { NextResponse } from 'next/server';
import { DOC_COLUMNS, UUID, authorizeDocs, bad, editingNow, namesOf } from '@/lib/docs/docsServer';

export const dynamic = 'force-dynamic';

// Make the draft the live doc: { id, base_revision, note?, force? }. Keeps the new text as a version, bumps the revision, clears the draft.
// Refused (409) when: someone published since you started (code 'published_elsewhere'), the draft holds someone else's edits (code 'others_in_draft'), or
// someone else has the doc open right now (code 'being_edited'). `force` goes ahead anyway, after the person has been told.
export async function POST(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Doc not found.', 404);
  const { data: doc } = await auth.svc.from('docs').select('id, revision, title, content, updated_by, updated_at, draft_title, draft_content, draft_updated_at, draft_updated_by').eq('id', id).maybeSingle();
  if (!doc) return NextResponse.json({ error: 'This doc was deleted by someone else.', code: 'deleted' }, { status: 404 });
  if (b.base_revision !== undefined && Number(b.base_revision) !== doc.revision && !b.force) {
    const who = (await namesOf(auth.svc, [doc.updated_by as string | null])).get(doc.updated_by as string) ?? 'Someone';
    return NextResponse.json({ error: `${who} published a newer version while you were editing.`, code: 'published_elsewhere', revision: doc.revision, by: who }, { status: 409 });
  }
  if (doc.draft_updated_at === null) return bad('There is nothing new to publish.');
  if (!b.force) {
    if (doc.draft_updated_by && doc.draft_updated_by !== auth.user.id) {
      const who = (await namesOf(auth.svc, [doc.draft_updated_by as string])).get(doc.draft_updated_by as string) ?? 'Someone';
      return NextResponse.json({ error: `The draft includes changes by ${who}.`, code: 'others_in_draft', by: who, at: doc.draft_updated_at }, { status: 409 });
    }
    const editing = (await editingNow(auth.svc, [id], auth.user.id)).get(id);
    if (editing?.length) return NextResponse.json({ error: `${editing.join(', ')} ${editing.length === 1 ? 'has' : 'have'} this doc open right now.`, code: 'being_edited', names: editing }, { status: 409 });
  }
  const title = ((doc.draft_title as string | null) ?? (doc.title as string)).trim() || (doc.title as string);
  const content = (doc.draft_content as string | null) ?? (doc.content as string);
  const { data, error } = await auth.svc.from('docs')
    .update({ title, content, published: true, revision: doc.revision + 1, updated_by: auth.user.id, updated_at: new Date().toISOString(), draft_title: null, draft_content: null, draft_updated_at: null, draft_updated_by: null })
    .eq('id', id).eq('revision', doc.revision).select(DOC_COLUMNS).maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Someone else published at the same moment. Reload and look at their version first.', code: 'published_elsewhere' }, { status: 409 });
  await auth.svc.from('doc_versions').insert({ doc_id: id, title, content, created_by: auth.user.id, note: typeof b.note === 'string' ? b.note.trim().slice(0, 120) || null : null });
  return NextResponse.json({ doc: data });
}
