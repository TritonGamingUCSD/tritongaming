import { NextResponse } from 'next/server';
import { UUID, authorizeDocs, bad } from '@/lib/docs/docsServer';
import { notifyDocs } from '@/lib/docs/docsLive';

export const dynamic = 'force-dynamic';

const COLUMNS = 'id, title, url, note, teams, order_index';
const HTTPS = /^https:\/\/\S+$/i;

// Quick links (the tiles on the documentation home) are not documents, so they have their own small API. Everyone who can read the docs can list them;
// changing them takes the same permission as editing a doc.
export async function GET() {
  const auth = await authorizeDocs('view_docs');
  if ('error' in auth) return auth.error;
  const { data } = await auth.svc.from('quick_links').select(COLUMNS).order('order_index').order('title');
  return NextResponse.json({ links: data ?? [] });
}

// { action: 'create', title, url, note?, teams? } | { action: 'update', id, title?, url?, note?, teams? } | { action: 'delete', id } | { action: 'reorder', ids }
export async function POST(request: Request) {
  const auth = await authorizeDocs('manage_docs');
  if ('error' in auth) return auth.error;
  const b = await request.json().catch(() => ({}));
  const fields: Record<string, unknown> = {};
  if ('title' in b) { const t = String(b.title ?? '').trim().slice(0, 120); if (!t) return bad('A quick link needs a title.'); fields.title = t; }
  if ('url' in b) { const u = String(b.url ?? '').trim(); if (!HTTPS.test(u) || u.length > 2000) return bad('The address must start with https://.'); fields.url = u; }
  if ('note' in b) fields.note = String(b.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if ('teams' in b) fields.teams = [...new Set((Array.isArray(b.teams) ? b.teams : []).map(String).filter((t: string) => UUID.test(t)))].slice(0, 30);

  if (b.action === 'create') {
    if (!fields.title || !fields.url) return bad('A quick link needs a title and an address.');
    const { data: last } = await auth.svc.from('quick_links').select('order_index').order('order_index', { ascending: false }).limit(1);
    const { data, error } = await auth.svc.from('quick_links').insert({ ...fields, created_by: auth.user.id, order_index: ((last?.[0]?.order_index as number | undefined) ?? -1) + 1 }).select(COLUMNS).single();
    if (error) return bad('Couldn’t add the quick link.', 500);
    await notifyDocs();
    return NextResponse.json({ link: data });
  }
  if (b.action === 'update') {
    const id = String(b.id ?? '');
    if (!UUID.test(id)) return bad('Quick link not found.', 404);
    const { data, error } = await auth.svc.from('quick_links').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select(COLUMNS).maybeSingle();
    if (error) return bad('Couldn’t save the quick link.', 500);
    if (!data) return NextResponse.json({ error: 'Someone already removed this quick link.', code: 'deleted' }, { status: 404 });
    await notifyDocs();
    return NextResponse.json({ link: data });
  }
  if (b.action === 'delete') {
    const id = String(b.id ?? '');
    if (!UUID.test(id)) return bad('Quick link not found.', 404);
    await auth.svc.from('quick_links').delete().eq('id', id);
    await notifyDocs();
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'reorder') {
    const ids = (Array.isArray(b.ids) ? b.ids.map(String) : []).filter((x: string) => UUID.test(x)).slice(0, 200);
    await Promise.all(ids.map((id: string, i: number) => auth.svc.from('quick_links').update({ order_index: i }).eq('id', id)));
    await notifyDocs();
    return NextResponse.json({ ok: true });
  }
  return bad('Unknown action.');
}
