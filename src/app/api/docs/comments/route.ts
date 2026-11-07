import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/admin';

import { createNotifications } from '@/lib/notifications/notify';
import { refuseBlocked } from '@/lib/wordfilter/server';
import { UUID, authorizeDoc, bad, namesOf } from '@/lib/docs/docsServer';

export const dynamic = 'force-dynamic';

const MAX = 1000;

// A simple thread under each doc. Anyone who can read the docs can comment; the commenter or an editor can delete; an editor can mark one resolved.
// GET ?doc_id=<id> -> the thread. POST { doc_id, body } adds one (the doc's author and last editor get a bell). PATCH { id, resolved } resolves or reopens it (editors). DELETE ?id=<id>.
export async function GET(request: Request) {
  const docId = new URL(request.url).searchParams.get('doc_id') ?? '';
  const auth = await authorizeDoc(docId, 'read');
  if ('error' in auth) return auth.error;
  // A draft that nobody can read yet has no readable thread either.
  const { data: d } = await auth.svc.from('docs').select('published').eq('id', docId).maybeSingle();
  if (!d || (!d.published && !auth.can.edit)) return bad('Doc not found.', 404);
  const { data } = await auth.svc.from('doc_comments').select('id, author_id, body, created_at, resolved_at').eq('doc_id', docId).order('created_at');
  const names = await namesOf(
    auth.svc,
    (data ?? []).map((c) => c.author_id as string | null),
  );
  const edit = auth.can.edit;
  return NextResponse.json({
    canEdit: edit,
    comments: (data ?? []).map((c) => ({
      id: c.id as string,
      body: c.body as string,
      created_at: c.created_at as string,
      resolved: !!c.resolved_at,
      author: c.author_id ? (names.get(c.author_id as string) ?? 'Someone') : 'Someone',
      mine: c.author_id === auth.user.id,
    })),
  });
}

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const docId = String(b.doc_id ?? '');
  const body = String(b.body ?? '')
    .trim()
    .slice(0, MAX);
  const auth = await authorizeDoc(docId, 'read');
  if ('error' in auth) return auth.error;
  if (!body) return bad('Write a comment first.');
  const blocked = await refuseBlocked({ Comment: body });
  if (blocked) return blocked;
  const { data: doc } = await auth.svc.from('docs').select('title, created_by, updated_by, published').eq('id', docId).maybeSingle();
  if (!doc || (!doc.published && !auth.can.edit)) return bad('Doc not found.', 404);
  const { count } = await auth.svc
    .from('doc_comments')
    .select('id', { count: 'exact', head: true })
    .eq('doc_id', docId)
    .eq('author_id', auth.user.id)
    .gte('created_at', new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 10) return bad('That’s a lot of comments in an hour. Try again later.', 429);
  const { data: row, error } = await auth.svc.from('doc_comments').insert({ doc_id: docId, author_id: auth.user.id, body }).select('id').single();
  if (error || !row) return bad('Couldn’t save that.', 500);
  const who = (await namesOf(auth.svc, [auth.user.id])).get(auth.user.id) ?? 'Someone';
  const told = [...new Set([doc.created_by as string | null, doc.updated_by as string | null].filter((x): x is string => !!x && x !== auth.user.id))];
  await createNotifications(
    auth.svc,
    told.map((user_id) => ({ user_id, type: 'doc_comment', title: `${who} commented on “${doc.title}”`, body: body.slice(0, 120), href: `/portal/docs?id=${docId}` })),
  );
  return NextResponse.json({ ok: true, id: row.id });
}

export async function PATCH(request: Request) {
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Comment not found.', 404);
  const { data: row } = await createServiceClient().from('doc_comments').select('doc_id').eq('id', id).maybeSingle();
  const auth = await authorizeDoc(String(row?.doc_id ?? ''), 'edit');
  if ('error' in auth) return auth.error;
  const { error } = await auth.svc
    .from('doc_comments')
    .update(b.resolved === false ? { resolved_at: null, resolved_by: null } : { resolved_at: new Date().toISOString(), resolved_by: auth.user.id })
    .eq('id', id);
  if (error) return bad('Couldn’t save that.', 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!UUID.test(id)) return bad('Comment not found.', 404);
  const { data: c } = await createServiceClient().from('doc_comments').select('author_id, doc_id').eq('id', id).maybeSingle();
  if (!c) return bad('Comment not found.', 404);
  const auth = await authorizeDoc(String(c.doc_id), 'read');
  if ('error' in auth) return auth.error;
  if (c.author_id !== auth.user.id && !auth.can.edit) return bad('You can only delete your own comments.', 403);
  await auth.svc.from('doc_comments').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
