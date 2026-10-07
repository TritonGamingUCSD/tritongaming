import { NextResponse } from 'next/server';
import { hasCapability } from '@/lib/portal/capabilities';
import { createNotifications } from '@/lib/notifications/notify';
import { UUID, authorizeDocs, bad, namesOf } from '@/lib/docs/docsServer';

export const dynamic = 'force-dynamic';

const MAX = 1000;

// A simple thread under each doc. Anyone who can read the docs can comment; the commenter or an editor can delete; an editor can mark one resolved.
// GET ?doc_id=<id> -> the thread. POST { doc_id, body } adds one (the doc's author and last editor get a bell). PATCH { id, resolved } resolves or reopens it (editors). DELETE ?id=<id>.
export async function GET(request: Request) {
  const auth = await authorizeDocs('view_docs');
  if ('error' in auth) return auth.error;
  const docId = new URL(request.url).searchParams.get('doc_id') ?? '';
  if (!UUID.test(docId)) return bad('Doc not found.', 404);
  const { data } = await auth.svc.from('doc_comments').select('id, author_id, body, created_at, resolved_at').eq('doc_id', docId).order('created_at');
  const names = await namesOf(auth.svc, (data ?? []).map((c) => c.author_id as string | null));
  const edit = hasCapability(auth.roles, 'manage_docs');
  return NextResponse.json({
    canEdit: edit,
    comments: (data ?? []).map((c) => ({ id: c.id as string, body: c.body as string, created_at: c.created_at as string, resolved: !!c.resolved_at, author: c.author_id ? names.get(c.author_id as string) ?? 'Someone' : 'Someone', mine: c.author_id === auth.user.id })),
  });
}

export async function POST(request: Request) {
  const auth = await authorizeDocs('view_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const docId = String(b.doc_id ?? '');
  const body = String(b.body ?? '').trim().slice(0, MAX);
  if (!UUID.test(docId)) return bad('Doc not found.', 404);
  if (!body) return bad('Write a comment first.');
  const { data: doc } = await auth.svc.from('docs').select('title, created_by, updated_by, published').eq('id', docId).maybeSingle();
  if (!doc || (!doc.published && !hasCapability(auth.roles, 'manage_docs'))) return bad('Doc not found.', 404);
  const { count } = await auth.svc.from('doc_comments').select('id', { count: 'exact', head: true }).eq('doc_id', docId).eq('author_id', auth.user.id).gte('created_at', new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 10) return bad('That’s a lot of comments in an hour. Try again later.', 429);
  const { data: row, error } = await auth.svc.from('doc_comments').insert({ doc_id: docId, author_id: auth.user.id, body }).select('id').single();
  if (error || !row) return bad('Couldn’t save that.', 500);
  const who = (await namesOf(auth.svc, [auth.user.id])).get(auth.user.id) ?? 'Someone';
  const told = [...new Set([doc.created_by as string | null, doc.updated_by as string | null].filter((x): x is string => !!x && x !== auth.user.id))];
  await createNotifications(auth.svc, told.map((user_id) => ({ user_id, type: 'doc_comment', title: `${who} commented on “${doc.title}”`, body: body.slice(0, 120), href: `/portal/docs?id=${docId}` })));
  return NextResponse.json({ ok: true, id: row.id });
}

export async function PATCH(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Comment not found.', 404);
  const { error } = await auth.svc.from('doc_comments').update(b.resolved === false ? { resolved_at: null, resolved_by: null } : { resolved_at: new Date().toISOString(), resolved_by: auth.user.id }).eq('id', id);
  if (error) return bad('Couldn’t save that.', 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await authorizeDocs('view_docs');
  if ('error' in auth) return auth.error;
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!UUID.test(id)) return bad('Comment not found.', 404);
  const { data: c } = await auth.svc.from('doc_comments').select('author_id').eq('id', id).maybeSingle();
  if (!c) return bad('Comment not found.', 404);
  if (c.author_id !== auth.user.id && !hasCapability(auth.roles, 'manage_docs')) return bad('You can only delete your own comments.', 403);
  await auth.svc.from('doc_comments').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
