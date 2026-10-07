import { NextResponse } from 'next/server';
import { UUID, authorizeDocs, bad, namesOf } from '@/lib/docs/docsServer';
import { notifyDocs } from '@/lib/docs/docsLive';

export const dynamic = 'force-dynamic';

// Throw away the unpublished draft: { id, force? }. The live doc is untouched. If the draft holds someone else's work it asks first (409 'others_in_draft').
export async function POST(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Doc not found.', 404);
  const { data: doc } = await auth.svc.from('docs').select('draft_updated_at, draft_updated_by').eq('id', id).maybeSingle();
  if (!doc) return NextResponse.json({ error: 'This doc was deleted by someone else.', code: 'deleted' }, { status: 404 });
  if (!b.force && doc.draft_updated_by && doc.draft_updated_by !== auth.user.id && doc.draft_updated_at) {
    const who = (await namesOf(auth.svc, [doc.draft_updated_by as string])).get(doc.draft_updated_by as string) ?? 'Someone';
    return NextResponse.json({ error: `The draft has changes by ${who}.`, code: 'others_in_draft', by: who, at: doc.draft_updated_at }, { status: 409 });
  }
  const { error } = await auth.svc.from('docs').update({ draft_title: null, draft_content: null, draft_updated_at: null, draft_updated_by: null }).eq('id', id);
  if (error) return bad('Couldn’t discard the draft.', 500);
  await notifyDocs();
  return NextResponse.json({ ok: true });
}
