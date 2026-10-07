import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logAudit } from '@/lib/notifications/audit';
import { createNotifications } from '@/lib/notifications/notify';
import { pacificDayKey } from '@/lib/events/checkinDays';
import { UUID, authorizeDocs, bad, namesOf } from '@/lib/docs/docsServer';

export const dynamic = 'force-dynamic';

export const REQUIRED_ROLES = ['officer', 'lead', 'division', 'exec'] as const;

// GET (no id): the docs I am required to read and haven't opened yet, for the banner on the docs home.
// GET ?id=<doc>: editors, who it is required for and who has read it.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) {
    const auth = await authorizeDocs('view_docs');
    // The dashboard asks everyone; people who can't read the docs simply have nothing required (a 403 would be console noise on every load).
    if ('error' in auth) { const e = auth.error as NextResponse; return e.status === 403 ? NextResponse.json({ unread: [] }) : e; }
    const mine = [...new Set((auth.roles as { role: string }[]).map((r) => r.role))];
    const { data: req } = await auth.svc.from('doc_required_roles').select('doc_id').in('role', mine.length ? mine : ['none']);
    const ids = [...new Set((req ?? []).map((r) => r.doc_id as string))];
    if (!ids.length) return NextResponse.json({ unread: [] });
    const [{ data: docs }, { data: reads }] = await Promise.all([
      auth.svc.from('docs').select('id, title').in('id', ids).eq('published', true),
      auth.svc.from('doc_reads').select('doc_id').eq('user_id', auth.user.id).in('doc_id', ids),
    ]);
    const read = new Set((reads ?? []).map((r) => r.doc_id as string));
    return NextResponse.json({ unread: (docs ?? []).filter((d) => !read.has(d.id as string)).map((d) => ({ id: d.id as string, title: d.title as string })) });
  }
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  if (!UUID.test(id)) return bad('Doc not found.', 404);
  const people = await expectedReaders(auth.svc, id);
  return NextResponse.json({ ...people });
}

async function expectedReaders(svc: SupabaseClient, docId: string) {
  const { data: req } = await svc.from('doc_required_roles').select('role').eq('doc_id', docId);
  const roles = (req ?? []).map((r) => r.role as string);
  if (!roles.length) return { roles, people: [] as { id: string; name: string; read_at: string | null }[] };
  const { data: holders } = await svc.from('user_roles').select('user_id').in('role', roles);
  const ids: string[] = [...new Set((holders ?? []).map((h) => h.user_id as string))];
  const [names, { data: reads }] = await Promise.all([namesOf(svc, ids), ids.length ? svc.from('doc_reads').select('user_id, read_at').eq('doc_id', docId).in('user_id', ids) : Promise.resolve({ data: [] })]);
  const readAt = new Map((reads ?? []).map((r) => [r.user_id as string, r.read_at as string]));
  const people = ids.map((uid) => ({ id: uid, name: names.get(uid) ?? 'Someone', read_at: readAt.get(uid) ?? null })).sort((a, b) => Number(!!a.read_at) - Number(!!b.read_at) || a.name.localeCompare(b.name));
  return { roles, people };
}

// Editors: PUT { id, roles } sets who the doc is required for (empty = not required). POST { id, action: 'remind' } sends a bell reminder to those who haven't read it (once a day).
export async function PUT(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id)) return bad('Doc not found.', 404);
  const asked: string[] = (Array.isArray(b.roles) ? b.roles : []).map(String);
  const roles = [...new Set(asked)].filter((r): r is (typeof REQUIRED_ROLES)[number] => (REQUIRED_ROLES as readonly string[]).includes(r));
  const { data: doc } = await auth.svc.from('docs').select('title').eq('id', id).maybeSingle();
  if (!doc) return bad('This doc was deleted by someone else.', 404);
  await auth.svc.from('doc_required_roles').delete().eq('doc_id', id);
  if (roles.length) { const { error } = await auth.svc.from('doc_required_roles').insert(roles.map((role) => ({ doc_id: id, role }))); if (error) return bad('Couldn’t save that.', 500); }
  await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'doc', entityId: id, summary: roles.length ? `Made "${doc.title}" required reading for ${roles.join(', ')}` : `Made "${doc.title}" optional reading` });
  return NextResponse.json({ ok: true, ...(await expectedReaders(auth.svc, id)) });
}

export async function POST(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const id = String(b.id ?? '');
  if (!UUID.test(id) || (b.action !== 'remind' && b.action !== 'reread')) return bad('Doc not found.', 404);
  const { data: doc } = await auth.svc.from('docs').select('title, published').eq('id', id).maybeSingle();
  if (!doc) return bad('Doc not found.', 404);
  if (!doc.published) return bad('Publish the doc first; people can’t read a draft.', 409);
  // "Ask for a re-read": after a big change, everyone's read mark is cleared and they are told once.
  if (b.action === 'reread') {
    await auth.svc.from('doc_reads').delete().eq('doc_id', id);
    await auth.svc.from('reminders_sent').delete().eq('item_key', `docread:${id}|${pacificDayKey()}`);
    await logAudit(auth.svc, { actorId: auth.user.id, action: 'update', entityType: 'doc', entityId: id, summary: `Asked everyone to re-read "${doc.title}"` });
  }
  const { people } = await expectedReaders(auth.svc, id);
  const unread = people.filter((p) => !p.read_at && p.id !== auth.user.id).map((p) => p.id);
  if (!unread.length) return NextResponse.json({ ok: true, sent: 0 });
  // Once a day per person per doc, so pressing the button twice doesn't nag.
  const { data: fresh } = await auth.svc.from('reminders_sent').upsert(unread.map((user_id) => ({ item_key: `docread:${id}|${pacificDayKey()}`, user_id })), { onConflict: 'item_key,user_id', ignoreDuplicates: true }).select('user_id');
  const ids = (fresh ?? []).map((f) => f.user_id as string);
  const sent = await createNotifications(auth.svc, ids.map((user_id) => ({ user_id, type: 'doc_required', title: b.action === 'reread' ? `Please read again: ${doc.title}` : `Please read: ${doc.title}`, body: b.action === 'reread' ? 'It changed in a way that matters. Please read it again.' : 'The exec team marked this as required reading.', href: `/portal/docs?id=${id}` })));
  return NextResponse.json({ ok: true, sent, already: unread.length - ids.length });
}
