import { NextResponse } from 'next/server';
import { staffName } from '@/lib/names';
import { UUID, authorizeDocs, bad, editingNow, namesOf } from '@/lib/docsServer';

export const dynamic = 'force-dynamic';

// GET ?id=<doc>: the doc's past versions, newest first, with who made each (editors only).
export async function GET(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!UUID.test(id)) return bad('Doc not found.', 404);
  const { data } = await auth.svc.from('doc_versions').select('id, title, content, created_by, created_at, note').eq('doc_id', id).order('created_at', { ascending: false }).limit(40);
  const ids = [...new Set((data ?? []).map((v) => v.created_by as string | null).filter((x): x is string => !!x))];
  const { data: ps } = ids.length ? await auth.svc.from('profiles').select('id, display_name, google_first_name, google_last_name').in('id', ids) : { data: [] as Record<string, unknown>[] };
  const name = new Map((ps ?? []).map((p) => [p.id as string, staffName(p as never)]));
  return NextResponse.json({ versions: (data ?? []).map((v) => ({ id: v.id, title: v.title, content: v.content, created_at: v.created_at, note: v.note, by: v.created_by ? name.get(v.created_by as string) ?? 'Someone' : 'Someone' })) });
}

// POST { id, version_id, force? }: bring a past version back as the draft (nothing goes live until it is published). That replaces the shared draft, so it asks
// first (409) when someone else has unpublished changes in it or has the doc open right now.
export async function POST(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? ''), versionId = String(b.version_id ?? '');
  if (!UUID.test(id) || !UUID.test(versionId)) return bad('Version not found.', 404);
  const { data: cur } = await auth.svc.from('docs').select('draft_updated_at, draft_updated_by').eq('id', id).maybeSingle();
  if (!cur) return NextResponse.json({ error: 'This doc was deleted by someone else.', code: 'deleted' }, { status: 404 });
  if (!b.force) {
    if (cur.draft_updated_at && cur.draft_updated_by && cur.draft_updated_by !== auth.user.id) {
      const who = (await namesOf(auth.svc, [cur.draft_updated_by as string])).get(cur.draft_updated_by as string) ?? 'Someone';
      return NextResponse.json({ error: `${who} has unpublished changes in this doc. Restoring replaces them.`, code: 'others_in_draft', by: who, at: cur.draft_updated_at }, { status: 409 });
    }
    const editing = (await editingNow(auth.svc, [id], auth.user.id)).get(id);
    if (editing?.length) return NextResponse.json({ error: `${editing.join(', ')} ${editing.length === 1 ? 'has' : 'have'} this doc open right now.`, code: 'being_edited', names: editing }, { status: 409 });
  }
  const { data: v } = await auth.svc.from('doc_versions').select('title, content').eq('id', versionId).eq('doc_id', id).maybeSingle();
  if (!v) return bad('Version not found.', 404);
  const { error } = await auth.svc.from('docs').update({ draft_title: v.title, draft_content: v.content, draft_updated_at: new Date().toISOString(), draft_updated_by: auth.user.id }).eq('id', id);
  if (error) return bad('Couldn’t restore that version.', 500);
  return NextResponse.json({ ok: true, title: v.title, content: v.content });
}
