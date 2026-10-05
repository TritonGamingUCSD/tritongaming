import { NextResponse } from 'next/server';
import { MAX_DOC_CHARS, UUID, authorizeDocs, bad, namesOf } from '@/lib/docsServer';

export const dynamic = 'force-dynamic';

// Autosave: { id, base_revision, base_draft_at, title?, content?, force?, rebase? }. Goes to the doc's shared draft, never the live page. Three things can have
// happened to the doc while you were typing, and each is reported instead of silently overwriting someone:
//   deleted              the doc is gone (404, code 'deleted')
//   published_elsewhere  someone published a newer version (409): `rebase` accepts it and carries on from there
//   draft_changed        someone else saved the shared draft after you last did (409, with their text): `force` writes over it
export async function POST(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Doc not found.', 404);
  const content = b.content === undefined ? undefined : String(b.content);
  const title = b.title === undefined ? undefined : String(b.title).trim().slice(0, 120);
  if (content !== undefined && content.length > MAX_DOC_CHARS) return bad('This doc is too long.');
  const { data: doc } = await auth.svc.from('docs').select('id, revision, title, content, updated_by, updated_at, draft_title, draft_content, draft_updated_at, draft_updated_by').eq('id', id).maybeSingle();
  if (!doc) return NextResponse.json({ error: 'This doc was deleted by someone else.', code: 'deleted' }, { status: 404 });

  if (b.base_revision !== undefined && Number(b.base_revision) !== doc.revision && !b.rebase) {
    const who = (await namesOf(auth.svc, [doc.updated_by as string | null])).get(doc.updated_by as string) ?? 'Someone';
    return NextResponse.json({ error: `${who} published a newer version while you were editing.`, code: 'published_elsewhere', revision: doc.revision, by: who, at: doc.updated_at, title: doc.title, content: doc.content }, { status: 409 });
  }
  const theirs = doc.draft_updated_at !== null && doc.draft_updated_by && doc.draft_updated_by !== auth.user.id;
  const sameAsMine = (b.base_draft_at ?? null) === doc.draft_updated_at;
  if (theirs && !sameAsMine && !b.force) {
    const who = (await namesOf(auth.svc, [doc.draft_updated_by as string])).get(doc.draft_updated_by as string) ?? 'Someone';
    return NextResponse.json({ error: `${who} saved changes to this draft while you were editing.`, code: 'draft_changed', by: who, at: doc.draft_updated_at, title: doc.draft_title, content: doc.draft_content }, { status: 409 });
  }

  const patch = { draft_title: title ?? doc.title, draft_content: content ?? doc.content, draft_updated_at: new Date().toISOString(), draft_updated_by: auth.user.id };
  const { error } = await auth.svc.from('docs').update(patch).eq('id', id);
  if (error) return bad('Couldn’t save the draft.', 500);
  return NextResponse.json({ ok: true, draft_updated_at: patch.draft_updated_at, revision: doc.revision });
}
